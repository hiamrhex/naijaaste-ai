# Changelog

All notable changes, newest first. Dates are commit dates (UTC).

## Unreleased

- Landing page at `/`, SPA under `/app` (multi-page build, router basename).
- Honest 413/400 for oversized/malformed bodies (was: fake 502).
- Real auth URLs (`/login`, `/signup`, `/forgot-password`) with guards, 403/404 screens, SPA fallback.

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
