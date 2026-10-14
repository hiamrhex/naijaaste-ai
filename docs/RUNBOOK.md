# Runbook

> One screen per scenario. Last verified: 2026-10-14.

## Database down (Neon unreachable / suspended)

- **Symptoms:** 500s spike, `requestId`-correlated PG errors in logs; `/health` still 200 by design (liveness never probes the DB) — use `GET /health/ready` which returns 503 `{"db":"down"}` while the DB is unreachable (2s bounded probe).
- **First 5 min:** confirm Neon dashboard status + compute state (suspended = quota or 5-min idle wake: first query is slow, not dead). Check `DATABASE_URL` (pooled) vs direct mix-up.
- **Diagnose:** `SELECT 1` against pooled URL; check CU-hours/storage caps on free plan.
- **Mitigate:** wake compute with a cheap query; if suspended on quota, upgrade or wait for monthly reset. Restart API after recovery (pg pool recovers automatically).
- **Verify:** signup → favorite → nearby round-trip; watch 5xx rate fall.
- **Follow-up:** postmortem if user data was at risk; consider readiness probe hitting the DB.

## Gemini down / slow / quota hit

- **Symptoms:** 502 `UPSTREAM_FAILURE` on agent/chat/recommend/review/persona; validation-only paths (400s) unaffected.
- **First 5 min:** check Google AI Studio status + key quota; confirm `GEMINI_API_KEY` valid.
- **Diagnose:** direct model call with `curl`; inspect `Retry-After`/error codes in logs (never shown to users).
- **Mitigate:** deterministic paths (nearby, favorites, cached catalogue) keep working — tell users AI answers are degraded. Reduce `RATE_LIMIT_LLM_MAX` temporarily to protect quota.
- **Verify:** one `/recommend` 200 after recovery.
- **Follow-up:** tune retries/backoff; consider model fallback.

## Leaked secret (any credential in repo, logs, or chat)

1. **Revoke/rotate immediately** — JWT secrets (invalidates all sessions), Gemini key, SMTP password, Neon password. Leaked = burned, even after deletion.
2. Purge from git history if committed (`git filter-repo` + force-push, coordinate — history rewrite).
3. Remove from logs/retention if present; extend pino redact list.
4. Verify: secret scan clean (`gitleaks detect`), login/refresh/OTP flows green.
5. Postmortem: how it leaked, guardrail added (CI secret scan already gates).

## Bad deploy + rollback

1. **Detect:** CI red (blocked) or post-deploy `/health` + smoke (signup → nearby → signin) failing.
2. **Rollback on Vercel:** dashboard → previous deployment → Promote to Production (<2 min). API is stateless; no data migration rollback needed unless a migration shipped (then: forward-fix migration, never `DOWN` by hand).
3. **Verify:** `/health` 200, endpoint count 27, one auth round-trip.
4. **Follow-up:** postmortem; add the missing gate that would have caught it.

## Abuse spike (scraping / reset bombing / cost loop)

1. **Detect:** 429-rate jump, LLM latency/cost spike, OTP send volume jump.
2. **Mitigate:** lower `RATE_LIMIT_LLM_MAX` / auth limits via env redeploy (no code change); block abusive IPs at Vercel firewall; rotate Gemini key if quota is being burned.
3. **Verify:** 429s with `Retry-After` on the abused surface; legit traffic unaffected.
4. **Follow-up:** tighten per-endpoint budgets; consider per-user LLM budgets.
