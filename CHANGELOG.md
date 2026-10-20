# Changelog

All notable changes, newest first. Dates are commit dates (UTC).

## Unreleased

- **Auth hardening (plan 015):** closed two account-enumeration oracles — the resend cooldown answered `429` for known emails and `200` for unknown ones, and `signin` skipped bcrypt for unknown emails so response time revealed who had an account. Known and unknown emails now get identical status, body and cost. Added a per-`(email, ip)` brute-force lockout (10 failures → 15 min) that cannot be aimed at a victim, per-flow rate-limit buckets, a length-first password policy with a common-password denylist, `Cache-Control: no-store` and `requestId` on every auth response.
- **OTP reset:** the reset journey now works end to end and is verified in a browser (`tests/e2e/auth-otp.spec.js`). Requesting a code and guessing a code draw on separate budgets, attempt accounting is atomic, and a resend always yields a usable code in dev mode.
- **Reliability:** the pooled database connection is retried once on a connection-level failure (the hosted Postgres endpoint can close an idle socket) instead of answering 500; the 50-place saved-spots cap is enforced on every driver, not only where the database honours row locks.
- **Dev/CI parity:** the test suite now runs on in-process pg-mem exactly like CI, so local runs no longer create accounts in the live database and no longer depend on a pooled connection that can be reset mid-run.
- **Reliability:** chat LLM failures now return clean `502 UPSTREAM_FAILURE` (was raw `500`); 20s LLM timeout, exponential backoff, circuit breaker, deterministic recommend fallback. Proven by drill (8/8).
- **Readiness:** `GET /health/ready` probes the DB (2s bound, `503` while down); `/health` stays up. Vercel `/health` → `/api` rewrite.
- **Operations:** SLO, threat model, postmortem template + one written postmortem, MATURITY scorecard, break-it battery (14) + agent-safety probes (5) with evidence in `docs/EVIDENCE.md`.
- **Docs:** README rewritten as a verified 381-line front door (156 tests, 29 endpoints, real screens, PWA status, Mermaid architecture + ER + auth diagrams). `SECURITY.md` root pointer. `check:docs` drift gate wired into CI (stale numbers, broken links, missing npm scripts).
- **Data:** Neon restore drill PASS (logical dump/restore, counts identical). Runtime JSON state untracked; all state in Postgres.

## 2026-10-14 — Postgres migration

- All runtime state (users, sessions, OTP, ratings, reports, catalogue) moved from JSON files to Postgres (Neon prod, pg-mem tests, one SQL surface).
- Catalogue readers use city/box/code pushdowns; 60-row curated seed + OSM import pipeline.
- Same-origin `/api` on Vercel; refresh cookie at root path with mirrored clear.

## 2026-10-12 — Security hardening (plans 008–014)

- `dev_otp` gated behind explicit flag; OTP/PII stripped from logs; pino redaction extended.
- LLM limiter enforced on `/api/v1` mounts; CORS fail-closed in production.
- Agent sessions owner-bound; session params UUID-validated; review tool id-first lookup.

## 2026-10-09 — Backend foundations (plans 001–006)

- Unified error contract, structured pino logging + request IDs, zod validation + fail-fast env, per-endpoint rate limits, graceful shutdown.
- JWT auth wave: signup/signin, rotating refresh, OTP reset via SMTP, Google sign-in, favorites, admin roles.
