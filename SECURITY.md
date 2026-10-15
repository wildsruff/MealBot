# Security baseline

## In place in starter

- No third-party runtime packages.
- API key read only from server environment.
- Request content type and body-size checks.
- Input length/range validation.
- Basic per-process rate limit.
- Provider timeout and bounded output tokens.
- Generic provider errors returned to clients.
- Request IDs and security response headers.
- No request body or prompt logging.

## Known limitations

- In-memory limits reset on restart and do not coordinate multiple instances.
- No authentication, persistent account controls, CSRF strategy (not needed for this JSON-only unauthenticated starter but reassess with sessions), durable spend ledger, WAF, or security monitoring yet.
- Do not trust client-provided identity or forwarding headers. Configure trusted proxies explicitly if deployed behind one.
- A public endpoint is not safe to expose with paid AI enabled until abuse and budget controls are completed.

## Release checklist

- Store secrets in deployment secret manager; rotate exposed keys immediately.
- Enable secret scanning and dependency/security alerts in GitHub.
- Require PR review and passing CI on the default branch.
- Add authentication, shared quotas, durable budgets, and audit trails.
- Limit retention; provide deletion workflows; avoid storing meal prompts unless needed and disclosed.
- Test oversized bodies, malformed JSON, invalid fields, rate-limit behavior, provider timeout, provider outage, and budget exhaustion.
- Never promise allergen safety; show users how to verify labels and cross-contact risks.
