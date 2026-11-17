# Roadmap

> Last rewritten 2026-11-17. Earlier versions of this file contained fabricated
> 2024–2025 timelines and "percent complete" numbers that did not match the
> repository. This version records only what is shipped or known to be missing;
> evidence lives in [`EVIDENCE.md`](EVIDENCE.md), [`AUDIT.md`](AUDIT.md) and
> [`MATURITY.md`](MATURITY.md).

## Vision

Become the most useful restaurant-discovery app for Nigerian food — local taste,
local prices, local vocabulary — without hiding the seams when the model or the
network fails.

## Current state (verified 2026-11-17)

Live: `https://naijataste-ai.vercel.app` · `/health` reports **34 endpoints** and
`version: 2.0.0`.

Shipped:

- Restaurant discovery: `GET /nearby` (haversine, indexed box prefilter),
  `GET /restaurants/geo`, map screen (Leaflet).
- AI: ReAct agent with tool calls, deterministic catalogue fallback when the
  model times out or the circuit opens, persona extraction, weighted
  recommendations, review generation.
- Auth: JWT access tokens + rotating refresh cookies, bcrypt-12, Google
  sign-in, email-OTP password reset, admin role.
- Saved data: favourites (50 cap, atomic), saved places (memory-first, 50 cap),
  1–5 star ratings with notes, feedback reports with tickets and admin triage.
- Frontend: React 19 + Vite, lazy routes, PWA/service worker, offline page,
  dark/light themes, English + Nigerian Pidgin copy.
- Operations: structured logs with request ids, `/health/ready` DB probe,
  admin-only `/metrics`, migrations under an advisory lock, secret scan and a
  docs-drift gate in CI.

## Now — correctness and operability

These are the open items that matter most. They are tracked with evidence, not
dates.

1. **Arm monitoring.** `SENTRY_DSN` is not set in the deployment and no uptime
   monitor watches `/health`, so an outage is found by a human (`MATURITY.md`
   risk 1). Code path is ready; this is configuration.
2. **Build SLO measurement.** The four SLIs and targets exist in `SLO.md`, but
   nothing computes or alerts on them yet.
3. **Daily OSM refresh.** The workflow is fixed but stays red until a repository
   `DATABASE_URL` (or `DATABASE_URL_DIRECT`) secret is added by the owner.
4. **Verify proxy trust.** `TRUST_PROXY` still defaults to `1`; the rate-limit
   key is only as trustworthy as that hop count on Vercel.
5. **Drill Neon branch restore.** Logical `pg_dump`/`pg_restore` passed; a
   branch-based PITR restore has not been performed.

## Next — product depth

- Restaurant-owner claims and menu management (not started).
- Review moderation and photo uploads (reports already carry screenshots;
  ratings do not).
- Multi-city catalogue expansion beyond the current curated seed + live rows.
- Push notifications for saved places (service worker exists; no push channel).

## Later — scale

- Multi-region serving and read replicas; today the pool is deliberately small
  and the measured `/nearby` bottleneck is pool size + round-trip latency.
- Partner analytics and loyalty features.
- Voice search and richer mobile clients.

## Explicit non-goals for now

- Payments and delivery logistics.
- Training a custom model; the product composes hosted Gemini models behind a
  fallback chain.
- Chasing 100% test coverage as a number — the gate is that the suite, lint,
  build, secret scan and docs check stay green.

## Contributing

Open an issue with the user problem and the evidence you have. Changes that
touch an endpoint, env var or documented number must update the docs in the same
PR; `npm run check:docs` enforces the mechanical part.
