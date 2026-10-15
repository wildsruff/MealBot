# Recovery runbook (initial)

## Severity levels

- **SEV-1:** leaked secret, unauthorized access, unexpected spend, or broad user-impacting outage.
- **SEV-2:** AI provider or core API unavailable for a sustained period, data integrity issue, or serious safety incident.
- **SEV-3:** isolated bug or degraded non-critical feature.

## First response

1. Record incident start time, owner, impact, and a short factual summary; do not paste user prompts or secrets into the incident record.
2. For suspected secret exposure: disable/rotate the key at the provider first, remove it from runtime configuration, then inspect audit logs and redeploy.
3. For unexpected spend: disable paid AI by setting `AI_PROVIDER=mock` or stopping the service; confirm provider spend controls; do not raise limits automatically.
4. For abuse: disable the affected endpoint or account and preserve only necessary security evidence under the retention policy.
5. For provider outage: keep paid retries bounded; return a safe temporary-unavailable response; do not silently switch to a more expensive model.
6. Restore from known-good commit/configuration, run tests, then deploy gradually.
7. Verify `/health`, one mock meal request, error rate, provider spend, and quota behavior.
8. Write a brief post-incident review with cause, impact, remediation, and owner.

## Recovery gaps before production

No database or durable user data exists in this starter, so backup/restore has not yet been implemented. Before storing user data, define encrypted backups, retention, RPO/RTO targets, and run a restore drill.
