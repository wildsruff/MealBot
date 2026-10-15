import http from 'node:http';
import { randomUUID } from 'node:crypto';

const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number.parseInt(process.env.PORT || '3000', 10),
  provider: process.env.AI_PROVIDER || 'mock',
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  rateWindowMs: positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateMax: positiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 20),
  maxRequestBytes: positiveInt(process.env.MAX_REQUEST_BYTES, 12_000),
  maxPromptChars: positiveInt(process.env.MAX_PROMPT_CHARS, 4_000),
  maxOutputTokens: positiveInt(process.env.MAX_OUTPUT_TOKENS, 700),
  maxCalls: positiveInt(process.env.AI_MAX_CALLS_PER_PROCESS, 100),
};

const rateBuckets = new Map();
let aiCallsThisProcess = 0;
const startedAt = Date.now();

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function send(res, status, payload, requestId) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'x-request-id': requestId,
  });
  res.end(body);
}

function getClientKey(req) {
  // Do not trust X-Forwarded-For unless a known proxy is configured explicitly.
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(key, now = Date.now()) {
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= config.rateWindowMs) {
    bucket = { startedAt: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  // Opportunistically prune expired keys to bound memory growth.
  if (rateBuckets.size > 5_000) {
    for (const [k, b] of rateBuckets) {
      if (now - b.startedAt >= config.rateWindowMs) rateBuckets.delete(k);
    }
  }
  return bucket.count <= config.rateMax;
}

async function readJson(req) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const error = new Error('Content-Type must be application/json');
    error.statusCode = 415;
    throw error;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > config.maxRequestBytes) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
}

function validateMealRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body must be a JSON object';
  if (typeof body.preferences !== 'string') return 'preferences must be a string';
  const preferences = body.preferences.trim();
  if (!preferences) return 'preferences is required';
  if (preferences.length > config.maxPromptChars) return `preferences must be ${config.maxPromptChars} characters or fewer`;
  if (body.servings !== undefined && (!Number.isInteger(body.servings) || body.servings < 1 || body.servings > 12)) {
    return 'servings must be an integer from 1 to 12';
  }
  if (body.budget !== undefined && (typeof body.budget !== 'number' || !Number.isFinite(body.budget) || body.budget < 0 || body.budget > 1000)) {
    return 'budget must be a number from 0 to 1000';
  }
  if (body.dietaryRestrictions !== undefined && (!Array.isArray(body.dietaryRestrictions) || body.dietaryRestrictions.length > 20 || body.dietaryRestrictions.some(x => typeof x !== 'string' || x.length > 100))) {
    return 'dietaryRestrictions must be an array of up to 20 short strings';
  }
  return null;
}

function buildPrompt(input) {
  const servings = input.servings ?? 2;
  const budget = input.budget === undefined ? 'not specified' : `$${input.budget}`;
  const restrictions = (input.dietaryRestrictions ?? []).join(', ') || 'none specified';
  return `Create a practical meal idea. Return concise JSON with keys: title, description, ingredients (array of strings), steps (array of strings), estimatedCost (string), and dietaryNote (string). Never claim that allergy safety is guaranteed; advise users to verify labels and cross-contamination with suppliers.\nServings: ${servings}\nBudget: ${budget}\nDietary restrictions: ${restrictions}\nPreferences: ${input.preferences}`;
}

async function generateMeal(input) {
  if (config.provider === 'mock') {
    return {
      title: 'Build-your-own veggie rice bowl',
      description: 'A flexible, budget-conscious starting point. Replace ingredients to suit your preferences.',
      ingredients: ['1 cup rice', '1 can beans, drained', '2 cups seasonal vegetables', '1 tablespoon oil', 'Salt, pepper, and spices to taste'],
      steps: ['Cook the rice according to its package instructions.', 'Cook vegetables in oil until tender.', 'Warm the beans, then serve over rice with vegetables and seasoning.'],
      estimatedCost: 'Estimate only; prices vary by location and store.',
      dietaryNote: 'Check ingredient labels and preparation surfaces for allergens and cross-contact.',
      mode: 'mock',
    };
  }
  if (config.provider !== 'openai') throw Object.assign(new Error('Unsupported AI_PROVIDER'), { statusCode: 500 });
  if (!config.apiKey) throw Object.assign(new Error('AI provider is not configured'), { statusCode: 503 });
  if (aiCallsThisProcess >= config.maxCalls) throw Object.assign(new Error('AI call safety limit reached; owner approval/configuration required'), { statusCode: 503 });
  aiCallsThisProcess += 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are MealBot, a practical meal-planning assistant. Be honest about uncertainty and costs. Do not give medical advice. Output valid JSON only.' },
          { role: 'user', content: buildPrompt(input) },
        ],
        max_tokens: config.maxOutputTokens,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      // Do not expose provider response bodies, keys, or request payloads to clients.
      throw Object.assign(new Error('AI provider request failed'), { statusCode: response.status === 429 ? 503 : 502 });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw Object.assign(new Error('AI provider returned an unexpected response'), { statusCode: 502 });
    let meal;
    try { meal = JSON.parse(content); } catch { throw Object.assign(new Error('AI provider returned invalid meal data'), { statusCode: 502 }); }
    return { ...meal, mode: 'ai' };
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('AI provider timed out'), { statusCode: 504 });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) }, requestId);
    }
    if (req.method !== 'POST' || url.pathname !== '/api/v1/meals') {
      return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' }, requestId }, requestId);
    }
    if (!checkRateLimit(getClientKey(req))) {
      res.setHeader('retry-after', String(Math.ceil(config.rateWindowMs / 1000)));
      return send(res, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' }, requestId }, requestId);
    }
    try {
      const body = await readJson(req);
      const validationError = validateMealRequest(body);
      if (validationError) return send(res, 400, { error: { code: 'INVALID_INPUT', message: validationError }, requestId }, requestId);
      const meal = await generateMeal(body);
      return send(res, 200, { data: meal, requestId }, requestId);
    } catch (error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
      const message = status >= 500 ? (status === 503 ? error.message : 'The request could not be completed') : error.message;
      return send(res, status, { error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message }, requestId }, requestId);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    // Deliberately log no request bodies, prompts, user preferences, or secrets.
    console.log(`MealBot listening on http://${config.host}:${config.port} (provider=${config.provider})`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
