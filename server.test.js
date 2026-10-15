import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './server.js';

async function withServer(fn) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try { await fn(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
}

test('health check returns status ok', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
    assert.ok(response.headers.get('x-request-id'));
  });
});

test('unknown route returns 404', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/not-a-route`);
    assert.equal(response.status, 404);
  });
});

test('meal endpoint rejects invalid input', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/v1/meals`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preferences: '' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_INPUT');
  });
});

test('meal endpoint returns local mock result by default', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/v1/meals`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferences: 'vegetarian, quick dinner', servings: 2 }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.mode, 'mock');
    assert.ok(Array.isArray(body.data.ingredients));
  });
});

test('meal endpoint rejects non-JSON requests', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/v1/meals`, { method: 'POST', body: 'hello' });
    assert.equal(response.status, 415);
  });
});
