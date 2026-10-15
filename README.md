# MealBot

A lean starter foundation for a meal-planning product. The first version provides a JSON API, a local mock meal generator, an optional OpenAI-compatible provider, basic input validation, request size limits, per-process rate limiting, health checks, and automated tests.

> **Not production-ready for public traffic yet.** The current rate limiter and AI call cap live in process memory. They reset on restart and are not shared across multiple server instances. Do not enable paid AI for an open public beta until a durable shared quota/budget ledger, authentication or stronger abuse controls, monitoring, and deployment secrets are in place.

## Requirements

- Node.js 22 or newer
- npm (included with Node.js)

## Run locally

1. Upload these files to `wildsruff/MealBot` or clone the repository.
2. Copy `.env.example` to `.env` if running locally.
3. Keep `AI_PROVIDER=mock` for the first run. No API key is needed.
4. Run `npm test`.
5. Run `npm start`.
6. Visit `http://127.0.0.1:3000/health`.

The project intentionally has no third-party runtime dependencies in this initial foundation.

## Try the API

```sh
curl -s http://127.0.0.1:3000/api/v1/meals \
  -H 'content-type: application/json' \
  -d '{"preferences":"quick vegetarian dinner","servings":2,"budget":15}'
```

## Optional AI provider

1. Create a server-side API key with the provider.
2. Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in the deployment's secret manager or local `.env`.
3. Never put the key in browser/mobile code, GitHub commits, screenshots, or chat messages.
4. Keep `AI_MAX_CALLS_PER_PROCESS` low during private testing.

The per-process call limit is only an emergency development guard, **not** a dollar budget. It is not a substitute for provider-side spend limits or a durable server-side ledger. Model pricing changes; verify current pricing before enabling paid usage.

## API

### `GET /health`
Returns service status and uptime. Do not expose this endpoint as a detailed diagnostics endpoint.

### `POST /api/v1/meals`
Request body:

```json
{
  "preferences": "quick vegetarian dinner",
  "servings": 2,
  "budget": 15,
  "dietaryRestrictions": ["vegetarian"]
}
```

`preferences` is required (up to 4,000 characters by default). `servings` is optional (1–12), `budget` is optional (0–1000), and `dietaryRestrictions` is an optional array of up to 20 short strings. The budget is a user preference, not a guaranteed live price quote.

## Before public beta: required work

- Replace in-memory rate limiting with a shared store and per-account quotas.
- Implement durable, atomic budget accounting that fails closed when unavailable; enforce the $150/month target with alerts and an explicit owner approval process before raising the cap.
- Add authentication, account deletion, retention policy, and abuse reporting.
- Add provider timeout/retry policy with bounded retries and idempotency where appropriate.
- Use a real database and migrations for accounts, preferences, saved meals, quota events, and moderation cases.
- Add privacy review, accessibility review, dependency/security scanning, backup/restore drills, and production observability that excludes message content by default.
- Add restaurant/recipe data only through licensed or permitted APIs; never scrape in violation of terms.
- Establish moderation owner, backup, response targets, and urgent escalation coverage.
- Protect `main` with required checks and review before merging.

See `docs/` for initial operating decisions and runbooks.
