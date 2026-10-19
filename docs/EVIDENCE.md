# EVIDENCE.md — living command/output ledger

Every claim in docs/ must be reproducible from a command in this file.
Windows/PowerShell 5.1 environment; dates in UTC.

## 2026-10-19 — Fix phase (approved audit findings; one commit per item)

| ID | Item | Fix | Proof | Commit |
|---|---|---|---|---|
| F21-01 | Sentry | `SENTRY_DSN` env contract (optional string, `env.js`); unset → quiet no-op | `tests/monitoring.test.js`: no-DSN no-op + capture-safe; workspace runs with no DSN send network traffic | `d11ee8e` |
| F21-02 | Sentry | Redaction contract: `redactHeaders` strips authorization/cookie/proxy-auth/setCookie; `redactEvent` masks email + password/token/otp/secret body fields (deep) | unit tests assert secrets and PII never survive in the serialized event; test caught an email leak in the first draft and forced the mask | `d11ee8e` |
| F21-03 | Sentry | Capture wiring: express `errorHandler` captures 5xx with requestId tags; serverless sync-crash path captures then rethrows; boot init in `src/server.js` + `api/index.js` cold start | lint + errors/serverless suites pass; arm procedure: set `SENTRY_DSN` in Vercel (documented in `.env.example`) | `d11ee8e` |
| F21-04 | /api/v1 live | `api/index.js` keeps the `/v1` prefix for `/api/v1/*` and strips outer `/api` only for the light prefix; `/health` stays unversioned by design | `tests/serverless.test.js` 5/5: `/api/v1/auth/signup` → 201, `/api/v1/auth/saved-places` anonymous → 401 (route reachable), dual-prefix same-behaviour test; ON DEPLOY: needs Vercel push — see Unverified | `d4b3629` |
| F21-05 | save delete | `DELETE /auth/saved-places/:id` — ownership in the WHERE clause; endpoint inventory updated | `tests/saved-places.test.js`: own row 200, other user 404 (row survives), bogus id 404, anonymous 401 | `5aa3d7c` |
| F21-06 | cap race | Cap enforced inside transaction: `BEGIN → SELECT users WHERE id=$1 FOR UPDATE → count → INSERT → COMMIT`; concurrent creates serialize per user | burst test: 8 parallel creates at 49 filled → exactly 1 × 201, 7 × 409 `SAVED_FULL`, final count exactly 50 | `5aa3d7c` |
| F21-07 | frontend delete | SavedScreen per-spot trash button + `window.confirm`, removing state guard, 404 "already gone" handled honestly | build green; card renders in both Fits and Might-fit lists | `5aa3d7c` |
| F21-08 | data quality | `sources.md` ref registry added (18 OSM + 18 CURATED + 2 budget codes); checker splits comma refs; uniqueness keys corrected (`state|lga|ward`, `term|language|category`); true dupes merged (daddawa, crayfish — 308→306) | `check-ng-data` exit 0 clean; **negative tests**: injected dup → exit 1; unregistered ref → exit 1; restored both → exit 0 | `dd300be` |
| F21-09 | data gate in CI | `check:ng-data` step added to CI verify job; ajv + ajv-formats now real devDependencies (transitive/home-dir resolution bug closed — one run had resolved ajv-formats from `C:\Users\HP\node_modules`) | CI validate via `node scripts/check-ng-data.mjs` locally from `npm i` tree | `dd300be` |
| F21-10 | docs drift | Test badge → dynamic GitHub Actions workflow shield; typed counts removed from README/CONTRIBUTING; live URL kept; roadmap updated (Sentry shipped, uptime/SLO still open) | `npm run check:docs` OK (22 files, links resolve, scripts verified) | `1733de3` |
| F21-11 | gates | Full local suite after all fix commits | lint clean · build + test:sw 6/6 · vitest **171/171 (29 files)** · secret scan clean (224 files) | this session |



## 2026-10-19 — AUDIT re-score session (agent-assisted)

Fresh evidence only. All live probes against `https://naijaaste-ai.vercel.app`
using a throwaway account (`audit-…@example.com`, deleted-not-created on prod
DB — account rows persist; no DELETE endpoint exists for saved places yet).
Credentials generated at probe time, kept in `%TEMP%`, never recorded here.

| ID | Area | Claim | Method | Result today |
|---|---|---|---|---|
| T19-01 | 20/32 | Live API is UP | `curl /health`, `/health/ready` | 200 `db:"up"`, 200 ready; 2.1s/1.3s cold-ish |
| T19-02 | 2/8/11 | Signup + signin work live; cookie/token posture | `POST /api/auth/signup`→201, `/api/auth/signin`→200; `-D -` header dump | refresh cookie: HttpOnly+Secure+SameSite=Strict, Max-Age 7d; HSTS incl-subdomains; strict CSP; X-Request-Id present; COOP/COEP+XFO+nosniff+XCTO all on |
| T19-03 | 6/25 | Canonical `/api/v1/*` paths 404 on LIVE | `POST /api/v1/auth/signup` | 404 `ROUTE_NOT_FOUND … /v1/auth/signup` (function strips `/api`); SPA uses `/api/auth/*` (works). Local Express serves `/api/v1/*` — dev/prod contract drift |
| T19-04 | 18 | Conflicting rate-limit headers on one response | signin header dump | `Ratelimit: limit=600` (apiLimiter) AND `Ratelimit-Limit: 20;w=900` (authLimiter) both present |
| T19-05 | 16 | CORS fail-closed live | `Origin: https://attacker.example` on `/health`, `/api/auth/saved-places`, OPTIONS preflight | no ACAO on any foreign-origin response (401/204/none) → browser blocks; same-origin OPTIONS reflects allowlisted origin |
| T19-06 | 18 | Anonymous LLM burn impossible live | `POST /api/agent` without token | 401 UNAUTHENTICATED before provider |
| T19-07 | 19/12 | One live AI call (operator-authorized, single) | `POST /api/agent` "Spicy jollof in Yaba, cheap" | 200; grounded reply w/ naira range + trace `[save_preference, search_restaurants, …]` |
| T19-08 | 12 (BOLA) | saved-places is owner-scoped by construction | routes; probe: user B list after A adds 4 | B list 200 = 0 rows; only 2 endpoints exist, both keyed on `req.user.id` (`auth.routes.js:314-336`, `store.js`) |
| T19-09 | 13 | saved-places accepts hostile names verbatim; no sanitizer | POST `<img src=x onerror=alert(1)>…`, `a\u202Eevil\u202C…` | 201; stored verbatim; UI renders as React text (`SavedScreen.jsx:166`, no `dangerouslySetInnerHTML`) — latent risk for any future HTML/email surface |
| T19-10 | 13 | 150-char name silently truncated server-side, no warning | POST 150 chars | 201, name cut at 100 (matches `store.js:29`); UI maxLength=100 |
| T19-11 | 7/5 | 50-cap has NO backstop (check-then-act) | 12 parallel POSTs as user B | 12×201; count-then-insert race (`store.js:41-46`); burst>50 would exceed cap; no DB constraint |
| T19-12 | 3 (UX/data) | Null price/hours never stated as fact | list after adds | `status:"unverified"`, `price_*:"unknown"`, Savings screen ranks via `unknowns` ("Needs check") |
| T19-13 | 3 (gap) | No DELETE/edit endpoint for saved places | route scan | only GET+POST — a full list is a one-way door; user cannot remove rows |
| T19-14 | 36/22 (PWA) | SW offline fix proven against the LIVE bundle | same greps as `scripts/sw.mjs` applied to live `GET /sw.js` | 16/16 PASS: navigate=NetworkOnly empty opts + denylist `/api`; offline.html refs=1; only via `setCatchHandler`; `restaurant-data-v2`; activate deletes stale caches; no private-path refs |
| T19-15 | 36/22 (PWA) | Old-SW staleness residual unproven | — | cannot verify a real visitor's installed old SW (`autoUpdate` + `skipWaiting` confirmed in source, but an already-installed old SW can keep controlling a tab until update) |
| T19-16 | 35 | Fresh full local gate | `npm run lint` / `npm run test:all` / `npm run scan:secrets` | lint clean; build 4.44s (+SW injectManifest 39 precache entries); test:sw 6/6; vitest **159/159** (28 files); secrets clean (219 files; README badge still says 156 — drift) |
| T19-17 | 23 (data) | New `data/ng/*` (untracked) validates but has quality issues | `node scripts/check-ng-data.mjs` | 4 schemas VALID (34/65/308/41 items) BUT 17 duplicate keys (Lagos|Eti-Osa, Abuja|AMAC ×7, …) warned + **40 source_refs not found in sources.md**; script exits 0 on warnings |
| T19-18 | 17 | check-ng-data imports undeclared deps | `node -e require.resolve` | `ajv`, `ajv-formats` resolve only transitively (not in package.json) — breaks on fresh install if upstream drops them |
| T19-19 | 6/40 | Spelling mix-up `naijaaste` vs `naijataste` | grep whole repo (no `naijataste-ai.vercel.app` anywhere) | brand/package/issuer `naijataste` (`package.json`, JWT iss `naijataste`) vs deploy repo/aud `naijaaste-ai`/`naijaaste-client`; URLs consistent (only the deployed spelling); naming inconsistency documented, not a broken-link bug |
| T19-20 | 32 | Uncommitted changes reviewed | `git diff package.json` + read probe | package.json: adds `check:ng-data` script (one line); `scripts/check-ng-data.mjs`: read-only Ajv validator for data/ng. No stray secrets. Nothing committed (per instruction) |

### Unverified after this session (supersedes only where marked)

- **Resolved:** Live Vercel API boots (T19-01/02) — old Unverified #1 closed.
- Still open: Neon free-plan quota ceilings; SMTP delivery on live (only template tests + dev-fallback fallback in local logs; not exercised live); Neon **branch** PITR restore (needs Neon API key); Playwright locally (`PW_CHANNEL=msedge`); 429 body shape never triggered live (30 gentle requests stayed under limits — T19 note: shape verified from code/headers only); a real visitor's stale old service worker (T19-15); SLO p95 aggregation/alerting machinery (G-3; unchanged).

### Probe residue (disclosed) and cleanup needed

Two throwaway audit accounts remain live (probe teardown intended to delete
them failed — access tokens expire in 15 min and stored creds were wiped too
early; honest miss, see note):

- `audit-715eee65@example.com` — 4 saved-places rows (incl. `<img src=x onerror=alert(1)>` and `a\u202Eevil\u202C` fixture names), 2 refresh-token sessions.
- User B (email in `%TEMP%\opencode\nta-bola-out.json`) — 12 race-probe rows, password not retained.

Cleanup (needs operator DB access; safe anytime, no scheduling dependency):
```sql
DELETE FROM users WHERE email LIKE 'audit-%@example.com';
-- cascades saved_places (users.id ON DELETE CASCADE, migrations/003)
```
Suggestions for any future audit script: perform teardown in the same
process that created resources (token refresh per response), or assert
deletion and retry-with-refresh on 401.


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
