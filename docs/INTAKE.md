# Intake — NaijaTaste AI

> Generated 2026-10-22. Per distinguished-systems §3.

## Context

**Purpose:** A Nigerian food discovery app — users chat with an AI agent to get restaurant recommendations tailored to budget, spice tolerance, location, and social context. Users can save favourites, build a personal wishlist (saved-places), rate visits, and report issues.

**Users:** Nigerian mobile-first users (students, young professionals, families) looking for trustworthy local restaurant intel. Primary journeys: (1) chat → recommendation → save, (2) browse nearby → favourite, (3) rate a visit, (4) report incorrect data.

**Failure cost:** User loses trust in recommendations; personal data (chats, preferences) exposed; AI quota burned by abuse; app silently down with no alert.

## Stack & Hosting

| Layer | Choice | Region |
|---|---|---|
| Frontend | React 19 + Vite + React Router (SPA, basename `/app`) | Vercel edge (static) |
| API | Express 4 (serverless handler in `api/index.js`) | Vercel Functions `iad1` (us-east-1) |
| Database | Neon Postgres (pooled URL, `max: 3` pool) | us-east-2 (single region, free tier) |
| AI | Google Gemini (`gemini-3.5-flash-lite` primary, chain to 3.5-flash/3.6-flash) | Google AI Studio (global) |
| Email | Gmail SMTP (App Password) — optional, fail-closed | Google |
| Auth | JWT (HS256, 15m access / 7d refresh), bcrypt-12, OTP via email | — |
| Monitoring | Sentry (code present, `SENTRY_DSN` not set in Vercel) | — |
| CI | GitHub Actions (lint, test, build, audit, secret-scan, SW test, data gate, Playwright E2E) | — |

## Data Classification

| Data | Classification | Where |
|---|---|---|
| Password hashes (bcrypt-12) | High | Neon `users` |
| Refresh tokens (hashed jti) | High | Neon `sessions` |
| Access tokens (JWT, 15m) | Medium | Client memory only |
| OTP codes (HMAC-hashed, 10m) | High | Neon `otp_codes` |
| Conversations / persona | Medium | Neon `sessions` |
| GEMINI_API_KEY, JWT secrets, SMTP pass | Critical | Vercel encrypted env / local `.env` (gitignored) |
| Catalogue (OSM + curated) | Low | Neon, rebuildable |

## Scale (Now & 12 Months)

- **Now:** < 100 DAU, < 1000 chat turns/day, < 5000 API req/day. Neon free tier (0.25–2 CU, 1 GB storage, 104 connections, 5 GB egress/mo, 6h PITR). Vercel Hobby (300s max duration, 4.5MB body, single region).
- **12mo target:** 10k DAU, 50k chat turns/day. Will need paid Vercel + Neon Pro, multi-region, and SLO enforcement machinery.

## Constraints

- **Budget:** Free tiers only until revenue. Neon free plan ceilings: storage 1 GB, CU-hours 190/mo, egress 5 GB/mo, connections 104 (pooled), PITR 6h. Vercel Hobby: 100 GB-hours/mo, 300s function timeout, single region.
- **Team:** Solo builder. Bus factor = 1.
- **Regulations:** NDPA (Nigeria) applies — personal data, consent, deletion rights. GDPR if EU users arrive. No formal privacy policy page yet.
- **Deadlines:** None external.

## Current Maturity

| Area | Status |
|---|---|
| Tests | 159 vitest + 2 Playwright E2E (green locally, CI green) |
| CI | Lint, build, test, audit (critical only), secret scan, SW test, data gate, Playwright |
| Deploys | Vercel auto-deploy on push to master; manual promote for rollback |
| Monitoring | Sentry code ready, **DSN not set** — no error tracking, no uptime monitor |
| Backups | Logical pg_dump/pg_restore drill PASS (2026-10-16); **Neon branch PITR unverified** |
| Docs | ARCHITECTURE, THREAT_MODEL (STRIDE), SLO (4 SLIs), SECURITY, RUNBOOK, POSTMORTEM_TEMPLATE, 7 ADRs, EVIDENCE ledger, AUDIT, MATURITY, INDEPENDENT_REVIEW |
| Known incidents | 1 postmortem (2026-10-15: chat 500 instead of 502 — fixed) |

## What "Done" Means (Success Criteria)

1. **Monitoring armed:** Sentry DSN set in Vercel; uptime check on `/health` with alert to human; SLO burn alerts defined.
2. **Canonical contract live:** `/api/v1/*` paths work on production (currently 404 — F1 in AUDIT).
3. **SLO machinery running:** p95 latency and AI success rate computed continuously; burn alert at 50% budget.
4. **Chat session auth fixed:** GET/DELETE `/chat/:id` require auth or capability; ownership enforced (D-1).
5. **Document headers live:** CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy on `/`, `/app/*`, `/sw.js`, `/offline.html` (D-2).
6. **Timing oracle closed:** signin/forgot-password timing parity within noise (D-4).
7. **Neon branch PITR drill:** restore from branch verified with timings.

## Risk Tier: T2 (Standard)

**Justification:** Public app with user accounts, personal data (emails, chats, preferences, location), AI features consuming paid quota, email flows (OTP/reset). No payments, health, or children's data. Single-region free-tier architecture accepted with documented limits. T3 would require multi-region, on-call, DR drills — not justified at current scale.

## System Map

```
[Browser SPA /app] ──https──▶ [Vercel serverless: Express api/index.js]
                                      │
                                      ├──▶ [Neon Postgres — pooled URL]
                                      ├──▶ [Google Gemini API]
                                      ├──▶ [Gmail SMTP (optional)]
                                      └──▶ [Google OIDC (token verify)]
[Anonymous user] ──https──▶ [static landing at /]
```

**Trust boundaries:** T0 unauthenticated visitor, T1 authenticated user, T2 admin (`ADMIN_EMAILS`), T3 operator (Vercel/Neon/Google consoles).

**Config/data change points:** Vercel env vars, Neon DB, Gemini model/key, SMTP creds, `data/ng/*` catalogues, feature flags (none yet), `vercel.json` headers/rewrites.

## What Would Hurt Most

**Silent outage + credential leak.** The API is live with real users but has **zero monitoring** (Sentry DSN unset, no uptime check). An outage goes unnoticed until a user complains. Simultaneously, the independent review found the documented CSP does not protect the SPA (served statically by Vercel, bypassing Helmet), and chat sessions use a capability-URL design that allows cross-user read/delete (D-1). A leaked JWT secret or Gemini key would burn quota and invalidate all sessions with no alert.