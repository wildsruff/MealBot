# Cost and budget policy

## Owner decision

- Target: **$150/month** across the product's paid services.
- No automatic budget increases and no automatic provider/model upgrades.
- At the cap, disable optional paid AI requests and return a safe unavailable response until the owner explicitly approves a change.
- Alert the owner before the cap is reached; define alert thresholds during deployment.

## Important implementation gap

The starter's `AI_MAX_CALLS_PER_PROCESS` is a temporary circuit breaker. It is not a dollar cap, resets when the process restarts, and is not shared across instances. Therefore keep `AI_PROVIDER=mock` until the production ledger exists.

## Required before paid beta

- Durable monthly spend ledger, atomic reservation before provider calls, reconciliation against provider usage, and a fail-closed behavior.
- Per-user and global request/token quotas.
- Provider-side spending limits and alerts where available.
- Include database, hosting, email, logs, analytics, taxes, and any data/API fees in the same monthly budget review.
- No retries that can multiply paid calls without a bounded retry budget.
- Owner approval recorded before raising the cap or changing providers/models.
