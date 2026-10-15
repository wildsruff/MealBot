# Architecture and build sequence

## Initial shape

- **API:** Node.js HTTP server with versioned `/api/v1` routes.
- **Meal generation:** provider adapter with a no-cost local mock as the default.
- **Safety boundaries:** request size limits, field validation, bounded output tokens, timeout, request IDs, basic rate limiting, no prompt/body logging.
- **Tests:** Node's built-in test runner.
- **CI:** GitHub Actions runs tests on pushes and pull requests.

## Planned production modules

1. Identity and account lifecycle.
2. Persistent user preferences and saved meal plans.
3. Durable quota and budget ledger (atomic, shared across instances).
4. AI provider interface, model routing controlled by explicit owner policy, and structured output validation.
5. Restaurant/recipe connectors with source attribution and freshness metadata.
6. Moderation queue, user reports, audit events, and escalation runbook.
7. Minimal aggregate analytics and cost/error dashboards.

## Principles

- Server-side secrets only.
- No automatic paid-provider upgrade or automatic budget increase.
- Do not log prompts, generated content, or unnecessary personal data.
- Treat model output as untrusted; validate before rendering or storing.
- Keep external restaurant availability/pricing separate from generated estimates.
- Fail closed when budget enforcement or authorization cannot be verified.
