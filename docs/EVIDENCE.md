# EVIDENCE.md — living command/output ledger

Every claim in docs/ must be reproducible from a command in this file.
Windows/PowerShell 5.1 environment; dates in UTC.

## 2026-10-14 — Full gate (items 3/4/6)

```
npm run lint            → clean (0 problems)
npm test                → Test Files 26 passed (26) | Tests 155 passed (155)
npm run build           → ✓ built in 3.48s
```

## Item 3 — XSS hardening (commit 7fb9fe4)

- `escapeHtml` applied to OTP email templates (`src/services/email.service.js`).
- `tests/xss.test.js` (4 tests): no `dangerouslySetInnerHTML` / `javascript:` href in src; `otpHtml` escapes `<script>`; injected path returns `application/json` + `nosniff`; chat markup stays JSON.

## Item 4 — CSP + token out of localStorage (commit 4187c56)

Header scan, `GET http://127.0.0.1:3001/health`:

```
content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https://fonts.gstatic.com;
  form-action 'self';frame-ancestors 'self';img-src 'self' data: https:;object-src 'none';
  script-src 'self' https://accounts.google.com;script-src-attr 'none';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;upgrade-insecure-requests;
  connect-src 'self' http://localhost:3000 https://accounts.google.com;frame-src https://accounts.google.com
strict-transport-security: max-age=31536000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: no-referrer
x-dns-prefetch-control: off
cross-origin-opener-policy: same-origin
permissions-policy: (absent — helmet ships none by default)
```

Notes: `style-src 'unsafe-inline'` retained for AuthGate's `<style>` + Google Fonts (documented in `src/app.js`); `crossOriginEmbedderPolicy: false` to keep Google Identity Services working. Token storage proof: `tests/auth-client.test.js` (2 tests) — localStorage never contains an access token; a fresh page load rehydrates the token via the httpOnly-cookie refresh before calling the API.

## Item 6 — LLM resilience (commit 8931770)

- `tests/resilience.test.js` (6 tests): breaker closed→open at threshold (fails fast, fn not called)→half-open after cooldown→closes on success, reopens on probe failure, reset works.
- `tests/recommend-fallback.test.js` (2 tests): with `callRecommendLLM` mocked to throw `CIRCUIT_OPEN`, `getRecommendations` returns `success:true, fallback:true` with 1–5 deterministic ranked picks + honest `message`, `meta.candidates_sent_to_llm: 0`; zero-match persona still fails closed (no invented rows).
- LLM call path: 20s per-attempt timeout (`LLM_TIMEOUT_MS`) + exponential backoff retry (429/422/5xx only) + circuit breaker (5 failures / 60s cooldown) + corrective JSON retry only on genuine parse errors.

## Item 7 — Observability: liveness/readiness split

- `GET /health` = liveness, never touches the DB (must stay 200 during outages).
- `GET /health/ready` = readiness, `SELECT 1` with a 2s bounded race → 200 `{db:"up"}` or 503 `{db:"down"}`; skipped by the rate limiter; listed in `/health` endpoints manifest.
- `tests/readiness.test.js` (4 tests): liveness doesn't query; ready 200 on success; 503 on query error; 503 on hung query (no hang). RUNBOOK's former "known gap" line now documents the split.

## Item 2 — Break-it battery (scripts/break-it.mjs)

Run: `node scripts/break-it.mjs` (BASE=http://127.0.0.1:3001) — **14 passed, 0 failed**:

| Attack | Expected | Result |
|---|---|---|
| Oversized body (20KB name) | 413 PAYLOAD_TOO_LARGE | 413 |
| Malformed JSON | 400 VALIDATION_ERROR | 400 |
| SQLi signin (email) | 401 generic | 401 |
| SQLi password | 401 generic | 401 |
| Tampered JWT | 401 | 401 |
| Forged signature | 401 | 401 |
| Refresh-token reuse | 200 then 401 | 200 then 401 |
| B lists A's favorites (BOLA) | empty | 0 rows |
| B deletes A's favorite | A intact | A has 1, del=200 for B (see Unverified) |
| Non-admin `/admin/stats` | 403 | 403 |
| X-Forwarded-For spoof ×25 | bypasses IP limiter when TRUST_PROXY=1 | documented — prod must set TRUST_PROXY=0 |
| Foreign-origin CORS (local) | reflected in dev only | `acao=https://evil.example` (prod guard tested in unit tests) |
| Non-UUID session id | 400 | 400 |
| Unknown UUID session | 404 SESSION_NOT_FOUND | 404 |

Note: B's `DELETE /auth/favorites/r001` returned 200 — ownership filter means it deleted nothing (A still had it). Idempotent-200 on foreign row is a documented choice, not a leak.

### DB-outage drill (same battery day)

Server booted with `DATABASE_URL=postgresql://dead:dead@127.0.0.1:5433/dead` (port 3002):

```
GET  /health          → 200 (liveness independent of DB)
GET  /health/ready    → 503 {"status":"unavailable","ready":false,"db":"down"}  (2s bounded probe — added this day)
POST /auth/signup     → 500 {"error":{"code":"INTERNAL","message":"Signup failed"}}  (no stack/DSN leak)
POST /auth/signin     → 500 generic INTERNAL
GET  /health again    → 200 — process survived both failures
```

### Chat upstream-failure drill (2026-10-15) — after the 500→502 fix

Self-contained drill (`drill-502.mjs`, temp): boots the server as a child process
on a free port with an intentionally invalid `GEMINI_API_KEY`, then sends 8
`POST /chat` requests so the circuit breaker opens.

```
booted ok on 3099
chat results: {"502 UPSTREAM_FAILURE":8}
PASS: upstream failure is a clean 502, no 500s
```

8/8 returned `502 UPSTREAM_FAILURE`; zero 500s. Fix in `src/services/chat.service.js`
(`isUpstreamFailure` + `UpstreamError`) — before this, `CIRCUIT_OPEN`/timeout/retryable
upstream errors surfaced as a generic 500. Regression test: `tests/resilience.test.js`
(`processChat` throws `ApiError` with `status: 502, code: 'UPSTREAM_FAILURE'`).

## Agent-safety probes (2026-10-15) — `scripts/agent-safety.mjs`

Run against local server; 5 probes, **4 pass / 1 inconclusive**:

```
PASS agent: system-prompt leak     — no system prompt in output, contained
PASS agent: cross-user leak        — no other-user data, contained
PASS agent: excessive agency       — no destructive tool available/called, contained
PASS agent: injection via tool field — no prompt/table effect, contained
FAIL llm: spend cap (RATE_LIMIT_LLM_MAX) — 0x429, 14 other
```

The one FAIL is **not** a missing cap. Investigation: all 14 `/chat` requests
returned `500`/`502`, not `429`, because the circuit was already open from
earlier Gemini failures — the limiter never got to count them. Root cause was a
real bug (upstream failure surfacing as 500), fixed and re-proven same day; see
"Chat upstream-failure drill" above. The `RATE_LIMIT_LLM_MAX` limiter itself is
unit-proven in `tests/limits-llm.test.js` and wired on the LLM routes in
`src/app.js:138-140`.

## Neon restore drill (2026-10-16) — PASS

Method: `pg_dump` (custom format) of the live Neon project → `CREATE DATABASE
naijataste_restore_drill_<ts>` on the same project (direct URL) → `pg_restore`
→ row-count comparison source vs restored → `DROP DATABASE`.
Honest scope note: this is a **logical restore into an isolated database**,
not a Neon *branch* — branch creation requires the Neon API/console (no API
key available). PITR branch restore remains Unverified.

```
pg_dump prod   : 36.53s   (dump size 42.6 KB)
CREATE DATABASE: ok (direct URL)
pg_restore     : 30.76s
source  : restaurants=210 migrations=2 users=17 sessions=7 ratings=2 reports=2
restored: restaurants=210 migrations=2 users=17 sessions=7 ratings=2 reports=2
VERIFIED: row counts identical
dropped naijataste_restore_drill_20261016090737
DRILL RESULT: PASS
```

First attempt failed (`pg_restore: database "sslmode=..." does not exist`):
PowerShell parsed `"$drillDb?"` as one variable token, emptying the URI path.
Fixed with `${drillDb}` — recorded because the failure shape is a useful
reference for any script building URIs in PS 5.1.

## Load ramp — local, NOT representative (2026-10-16)

**These numbers are measured on one Windows laptop calling a remote Neon
project over the public internet, with the per-IP limiter raised to 100000.
They say nothing about what Vercel would serve.** Do not quote them as
production capacity.

`autocannon`, 15s per step, `GET /api/v1/nearby?lat=6.52&lng=3.38&limit=10&radius_km=50`:

| Concurrency | rps | p97.5 | p99 | non-2xx | errors |
|---|---|---|---|---|---|
| 10 | 3 | 7268ms | 9670ms | 0 | 0 |
| 50 | 1 | 9545ms | 9545ms | 0 | 39 timeouts |
| 200 | 1 | 9673ms | 9673ms | 0 | 194 timeouts |

Where it first degrades: between c=10 and c=50 — throughput falls to 1 rps and
every request past the first ~11 in a window times out.

**Why, isolated with measurements:**

| Component | Measurement |
|---|---|
| `SELECT 1` round-trip to Neon | 175–230ms (5 samples) |
| Box query, 50km radius (164 rows returned of 210 total) | 177–204ms, stable across 8 samples |
| `src/db/pool.js:18` | `max: 3` — three pooled clients for 210 concurrent requests |

So the bottleneck is **connection-pool size versus concurrency**, not query
cost and not an N+1 (`nearby.routes.js:22` issues exactly one box query; the
haversine filter at line 29 is in-process). With 3 clients and ~200ms per
round trip, the ceiling is roughly 15 queries/s across all in-flight requests —
which is what 3 rps at c=10 reflects. Raising the pool is not free: Neon's
free plan caps total connections, so this is a real trade to resolve with the
plan's actual limit (recorded in Unverified).

Control measurement, same box, no DB — `GET /health`, in-process only:

| Concurrency | rps | p97.5 | p99 | non-2xx |
|---|---|---|---|---|
| 10 | 1687 | 13ms | 18ms | 0 |
| 50 | 1804 | 53ms | 60ms | 0 |
| 200 | 1939 | 154ms | 174ms | 0 |

Same app, same machine: 1939 rps with no DB round trip versus 1 rps at c=200
with one. The ~200ms network hop is the entire difference.

## Earlier sessions (selected)

- CI full green on `95fc8f2` (jobs: verify, audit, e2e) — via `api.github.com/repos/hiamrhex/naijaaste-ai/actions/runs`.
- Neon live migration: migrations 001+002 applied; 60 curated + 150 OSM rows counted.
- Live endpoint sweep (earlier): 30/30 green.
- `node scripts/scan-secrets.mjs` → clean, 190 files, 1 allowlisted fixture.

## Unverified (open)

1. **Live deploy URL** — URL provided; landing/`/app` return 200. The API function is dead on Vercel (`FUNCTION_INVOCATION_FAILED`): the 5 required env vars (`GEMINI_API_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `DATABASE_URL`) are set locally but not in the Vercel project. `/health`→`/api` rewrite is pushed (`8fd1bb9`); live header scan still pending until the function boots.
2. **Prod database** — Neon DSN not present in `.env` right now (placeholders only); migration+seed proven earlier against pasted keys, must be re-run from `.env` when re-supplied.
3. **GEMINI_API_KEY invalid** — Google returns `API_KEY_INVALID`; all LLM calls exercise the new fallback path locally until key is rotated.
4. **k6 / Playwright browsers not local** — perf ramp relies on CI-equivalent runs; local e2e uses `PW_CHANNEL=msedge`.
5. **SMTP** — App Password pending; email delivery only verified by template unit tests.
6. **B-delete-a-favorite 200 idempotency** — decide if foreign-row DELETE should be 404 instead of silent 200.
