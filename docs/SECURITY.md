# Security

> Threat-model thinking, controls inventory, and disclosure live here.
> Last verified: 2026-10-16. Threat model deep-dive: [`THREAT_MODEL.md`](THREAT_MODEL.md).

## Threat model (summary)

| Asset | Attackers | Entry points | Key mitigations |
|---|---|---|---|
| Accounts + sessions | Credential stuffing, phishing | signup/signin/reset/Google | bcrypt-12, generic 401s with equal cost, per-(email, ip) lockout after 10 failures, OTP attempt caps + cooldown, jti revocation |
| Refresh tokens | XSS theft, replay | cookie, `/auth/refresh` | httpOnly root-path cookie, rotation + reuse → 401, mirrored clear, `Cache-Control: no-store` |
| Conversations | Session-ID guessing, cross-user reads | `/chat/:id`, `/agent` | UUID validation, owner binding + 403, bearer-only anonymous reads (documented) |
| Gemini quota/budget | Scraping, cost loops | 6 LLM routes × 2 mounts | 10/min per-client limiter both mounts, MAX_STEPS=6, token caps |
| Mailbox abuse | Reset bombing | `/auth/forgot-password` | IP budget, 60s resend cooldown (absorbed silently), fail-closed without SMTP |
| Account enumeration | Credential stuffing, phishing | `/auth/forgot-password`, `/auth/signin` | identical status/body/timing for known and unknown emails, denylist, no `429` cooldown signal |
| Logs/repo | Secret leakage | pino, error bodies | Redact list (OTP/password/credential/token), `dev_otp` flag-gated, secret-scan CI |

Out of scope (explicit): DDoS absorption (provider edge), device compromise, Gemini-side data handling.

## Controls checklist

- [x] zod validation on bodies/params/env; `validate()` middleware on LLM routes
- [x] Ownership checks (chat sessions, agent sessions, favorites, ratings); role gate on `/admin/*`. Chat sessions return `404` to non-owners (`tests/chat-ownership.test.js`); favorites/saved-places filter in SQL and return `200 {"removed":false}` / `404` without leaking rows.
- [x] Timing-safe OTP compare; HMAC-hashed codes; 10-min TTL; atomic attempt accounting
- [x] No enumeration oracle: known and unknown emails get identical status, body and timing
- [x] Brute-force lockout on `(email, ip)` — 10 failures → 15 min, cleared on success
- [x] Length-first password policy + common-password denylist + email-derived rejection
- [x] `Retry-After` + draft-7 `RateLimit` headers on every 429
- [x] `Cache-Control: no-store` + `requestId` on every auth response
- [x] CORS allowlist, fail-closed boot in production
- [x] Helmet headers on API JSON; document CSP (`script-src 'self'` + Google; `object-src 'none'`, `frame-ancestors 'self'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` defined in `vercel.json` (commit `0156780`, `tests/deployment-config.test.js`). **Not yet live:** on 2026-10-21 the deployment served no document CSP and `0156780`'s `/offline.js` returned `404`, so live enforcement is unverified.
- [x] Access token memory-only on client; localStorage holds `{ user }` only (`src/lib/auth.js:13-17`); refresh cookie httpOnly
- [x] Pooled-DB resilience: one retry on a connection-level failure, TCP keepalive on

## Reporting vulnerabilities

**Do not open public issues for security bugs.** See [`SECURITY.md`](../SECURITY.md): email the maintainer with repro steps, impact, and affected version; expect acknowledgement within 72 hours and coordinated disclosure.

## Dependency triage (audit gate policy)

- `npm audit --omit=dev --audit-level=critical` blocks CI. Zero criticals as of 2026-10-16.
- Known HIGHs (all in the Vite build chain: `vite`, `postcss`, `brace-expansion`, `nanoid`, `source-map-js`; 1 moderate in `uuid`): unreachable at request-serving runtime — the served app never executes build tooling. Re-triage on every Vite major bump.
- `npm run scan:secrets` (repo-native, offline) blocks CI. One allowlisted fixture (`tests/engagement.test.js` throwaway password, annotated in-line).
