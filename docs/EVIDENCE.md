# EVIDENCE.md — living command/output ledger

Every claim in docs/ must be reproducible from a command in this file.
Windows/PowerShell 5.1 environment; dates in UTC.

## 2026-10-14 — Full gate (items 3/4/6)

```
npm run lint            → clean (0 problems)
npm test                → Test Files 25 passed (25) | Tests 151 passed (151)
npm run build           → ✓ built in 14.32s
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
POST /auth/signup     → 500 {"error":{"code":"INTERNAL","message":"Signup failed"}}  (no stack/DSN leak)
POST /auth/signin     → 500 generic INTERNAL
GET  /health again    → 200 — process survived both failures
```

## Earlier sessions (selected)

- CI full green on `95fc8f2` (jobs: verify, audit, e2e) — via `api.github.com/repos/hiamrhex/naijaaste-ai/actions/runs`.
- Neon live migration: migrations 001+002 applied; 60 curated + 150 OSM rows counted.
- Live endpoint sweep (earlier): 30/30 green.
- `node scripts/scan-secrets.mjs` → clean, 190 files, 1 allowlisted fixture.

## Unverified (open)

1. **Live deploy URL** — no Vercel URL provided; front-door/`/app` routing, HSTS, prod CORS/TRUST_PROXY guard unverified against a real origin.
2. **Prod database** — Neon DSN not present in `.env` right now (placeholders only); migration+seed proven earlier against pasted keys, must be re-run from `.env` when re-supplied.
3. **GEMINI_API_KEY invalid** — Google returns `API_KEY_INVALID`; all LLM calls exercise the new fallback path locally until key is rotated.
4. **k6 / Playwright browsers not local** — perf ramp relies on CI-equivalent runs; local e2e uses `PW_CHANNEL=msedge`.
5. **SMTP** — App Password pending; email delivery only verified by template unit tests.
6. **B-delete-a-favorite 200 idempotency** — decide if foreign-row DELETE should be 404 instead of silent 200.
