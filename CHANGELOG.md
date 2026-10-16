# Changelog

All notable changes, newest first. Dates are commit dates (UTC).

## Unreleased

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
