# Independent Review — NaijaTaste AI

> **Mode:** adversarial, read-only QA audit (AUDIT) · **Risk tier:** T2
> **Target:** `https://naijataste-ai.vercel.app` (live) + repo `C:\Users\HP\NaijaTaste-ai` @ `a23986c`
> **Window:** 2026-10-19 23:08 – 2026-10-20 00:04 UTC (≈56 min)
> **Auditor:** independent session, no prior authorship of this codebase
> **Constraints honoured:** gentle tests only · ≤10 LLM calls (8 used) · no file edits outside `docs/INDEPENDENT_REVIEW.md` + a marked section in `docs/EVIDENCE.md` · no third-party probing · no secrets printed
> **Disclosed deviation:** 3 throwaway accounts created (limit was 2); the third was required for the mass-assignment probe. See §6.

> **Deployment-name note:** the audit began against `naijaaste-ai.vercel.app`. That project now returns `DEPLOYMENT_NOT_FOUND`; the live deployment is `naijataste-ai.vercel.app` (health checked at 23:48 UTC). All results below are from the live host that answered `/health` with 200. The README and `scripts/capture-media.mjs` still point at the dead `naijaaste` spelling.

> **Scope & concurrency note (important).** Findings describe the **deployed build** (`a23986c`, live at `naijataste-ai.vercel.app`). While the audit was running, the local working tree gained uncommitted, unrelated changes that appear to address several of these findings — per-surface auth limiters (`signup/signin/refresh/forgot/reset`), a per-`(email, ip)` lockout, `noStore` on token responses, and pool changes (`src/routes/auth.routes.js`, `src/auth/lockout.js`, `src/db/pool.js`, `src/env.js`). Those changes were **not deployed** when the probes ran, so D-4/D-10 still reproduce against the live host. Re-run §7 after deploying to confirm they are closed; I did not modify or review that in-flight work.

---

## 1. Scoreboard

Scored against the distinguished-systems layers, **evidence-only** (no evidence ⇒ 0).
Evidence IDs (`IQ-##`) resolve to raw probe output in `docs/EVIDENCE.md` §“Independent review evidence”.

| # | Area | Score (0–3) | What the evidence supports | What blocks a higher score |
|---|---|---|---|---|
| 1 | **Security** | **2** | JWT sig-tamper → 401, `alg:none` rejected; refresh rotates and replays → 401; signout revokes; BFLA `/admin` → 403; `role:"admin"` mass-assignment ignored; SQLi strings inert (parameterised); CORS refuses foreign origin; cookie `HttpOnly; Secure; SameSite=Strict; Path=/`; agent refused credential exfiltration (IQ-16,18,22,23) | Chat sessions are bearer-capability only — no auth on `GET`/`DELETE /api/v1/chat/:id` (IQ-26); no CSP/XFO/nosniff on any HTML document (IQ-27); timing enumeration (IQ-21) |
| 2 | **Data** | **2** | 60 curated rows, 8 cities, 0 duplicate IDs, 0 invalid coords, 0 missing name/city (IQ-24); live API returns consistent schema; OSM provenance documented | `opening_hours` null on **60/60** curated rows (IQ-24); OSM rows surface invented defaults (`price_tier:"mid"`, `spice_profile:"medium"`, `ambience:"casual"`) as if measured (IQ-24b) |
| 3 | **Reliability** | **2** | `/health` 200, `/health/ready` 200 `db:"up"` (IQ-01); ramp 5/10/20 users, 1,906 requests, **0 errors**, p50 ≈234 ms, p99 ≤922 ms (IQ-25) | 2 of 8 LLM calls returned `502 UPSTREAM_FAILURE` with no retry/fallback observed (IQ-18, IQ-26); DB-down readiness 503 path untested |
| 4 | **Operations** | **1** | `X-Request-Id` on nearly all responses; health/readiness split; runbook/SLO/postmortem docs exist | Some errors omit `requestId` in body (IQ-19); own docs say Sentry is **not armed** (EVIDENCE F21-16); no alerting/backup/restore evidence available to an outside auditor |
| 5 | **Quality** | **1** | `npm run build` passes (1,801 modules, 5.3 s); 26 test files exist incl. ownership/XSS/limiter suites | Suite **not run** (out of read-only scope); behaviour contradicts its own “ownership tested” claim; no E2E result available |
| 6 | **Governance** | **1** | Rich ADRs, threat model, SLO, runbook, decision log | Multiple **material claims contradicted by the live system**: “CSP enforced in production”, “ownership enforced (tested)”, “legacy `/` serves identical handlers”, “reset 10/min” (IQ-27, IQ-26, IQ-28, IQ-14) |

**Overall maturity: L2 — “defined but not independently verified.”**
Strong fundamentals and unusually good documentation, but the documentation outruns the deployed reality. L3 is not reachable in one black-box session: it needs the test suite green, admin paths exercised, monitoring armed, and a restore/load drill observed.

> **Hard-rule check.** No *critical* (admin takeover, secret exfiltration, SQLi/RCE, auth bypass to another tenant’s PII) was proven, so the “critical ⇒ cap at L1” rule is **not** invoked. The chat-session issue is a documented capability-URL design (`plans/012-session-ownership.md` deliberately keeps anonymous chat bearer-only), so it is graded **High**, not Critical. If a reviewer classifies unauthenticated destructive access to another user’s conversation as critical, the cap applies and the overall grade drops to **L1**.

---

## 2. Claim ledger (docs vs. measured reality)

| # | Claim | Source | Measurement | Verdict |
|---|---|---|---|---|
| C1 | “CSP **enforced** in production” | `docs/SECURITY.md:26` | `/`, `/app/`, `/app/login`, `/sw.js`, `/offline.html` → **no** `Content-Security-Policy` header, **no** CSP `<meta>` (IQ-27) | ❌ **False** — CSP is applied only to API JSON responses |
| C2 | “Strict CSP … helmet headers, nosniff, frame-ancestors self” | `README.md:266` | Documents return no `X-Frame-Options`, no `X-Content-Type-Options`, no `Referrer-Policy` (IQ-27) | ❌ **False for the app the browser executes** |
| C3 | “Ownership enforced: cross-user session/favorite/rating access → 403/404 (tested)” | `README.md:262` | User B **read** and **deleted** user A’s chat session (both 200); A then 404 (IQ-26) | ❌ **False for sessions** (true for favorites/saved-places/ratings) |
| C4 | “Ownership checks on every user-scoped resource” | `SECURITY.md:24`, `docs/THREAT_MODEL.md:43` | Same as C3 | ⚠️ **Overstated** |
| C5 | “Express 4 API (`/api/v1` + legacy `/`) … both serve identical handlers” | `README.md:103`, `docs/API.md:7`, `src/app.js:173-186` | `/api/*` → 200/401 ✅; **bare** `/nearby`, `/auth/me`, `/chat` → 404 (IQ-28) | ⚠️ **Partial** — bare `/` mount is unreachable on Vercel (no rewrite) |
| C6 | “Rate limits: auth 20/15 min, reset **10/min**, LLM 10/min, global 600/15 min” | `README.md:265` | API `limit=600`/15 min ✅; LLM `limit=10`/min ✅; auth limiter is 20/15 min ✅; **reset limiter is `windowMs 15 min`, max 10** (`auth.routes.js:24-30`) | ⚠️ **3/4 true** — reset is 10/**15 min**, not 10/min |
| C7 | “Refresh rotation with reuse detection; logout revokes server-side” | `README.md:263` | Rotated on first refresh; old cookie replay → 401 `INVALID_REFRESH`; signout → refresh 401 (IQ-20) | ✅ **True** |
| C8 | “Access tokens never touch `localStorage`” | `README.md:263`, `docs/SECURITY.md:27` | `src/lib/auth.js:13-24` keeps token in memory, persists `{user}` only (IQ-23) | ✅ **True** (static) |
| C9 | “Malformed JSON → 400” | `README.md` contract | live `{bad json` → 400 `VALIDATION_ERROR`, no stack (IQ-19) | ✅ **True** (was 500 before the fix landed; see §4 D-11) |
| C10 | “Non-admin ⇒ 403 on `/admin`” | `README.md`, `docs/THREAT_MODEL.md` | user token → 403 `FORBIDDEN` (IQ-16) | ✅ **True** |
| C11 | “60 curated restaurants, 8 cities, full fields” | `docs/DATA.md:9` | 60 rows, 8 cities, but **0/60 have `opening_hours`** (IQ-24) | ⚠️ **Partial** — “full fields” is not accurate |
| C12 | “Contract tests pin 400/401/403/404/409/413/429 shapes” | `README.md:280` | 413 came from **Vercel**, not the app (6 MB body); app limit is 10 kb (IQ-19) | ⚠️ **Misattributed** — the tested 413 is the platform’s, not the app’s |
| C13 | “`/health` exempt from rate limits” | `README.md:265` | `/health` returns **no** `RateLimit` header (IQ-14) | ✅ **True** |
| C14 | Production site is `naijaaste-ai.vercel.app` | `README.md:9`, `scripts/capture-media.mjs:27` | That host returns `DEPLOYMENT_NOT_FOUND`; live host is `naijataste-ai` (IQ-00) | ❌ **Stale pointer** |

---

## 3. Top 10 defects (ranked)

### D-1 · HIGH — Chat sessions have no authentication or ownership (cross-tenant read + delete)
`GET /api/v1/chat/:sessionId` and `DELETE /api/v1/chat/:sessionId` mount with **no** `requireAuth` and **no** owner check (`src/routes/chat.routes.js:39-62`); `POST /api/v1/chat` is fully anonymous too. Ownership exists **only** on `POST /api/v1/agent` (`src/routes/agent.routes.js:19-25`).
**Repro (live):** A creates session `2add7622-…` → B `GET` it → **200** with A’s persona/history → B `DELETE` it → **200** → A `GET` → **404** (IQ-26).
**Impact:** anyone holding/guessing a `session_id` can read and destroy another person’s conversation and inferred preferences. UUIDv4 makes guessing impractical, so this is a capability-URL design — but it is **unauthenticated and destructive**, and docs claim 403/404.
**Fix:** require auth on `GET`/`DELETE`; store `user_id` on session creation (currently always `null`, `chat.service.js:39`); return 404 for foreign rows.

### D-2 · HIGH — No CSP or anti-framing headers on the documents that actually run
Helmet is attached to Express only; Vercel serves `dist/` statically, so `/`, `/app/*`, `/sw.js`, `/offline.html` bypass it entirely (IQ-27). They do carry `Access-Control-Allow-Origin: *`.
**Impact:** the flagship “strict CSP” control does not protect the SPA; any future XSS sink (or a compromised CDN dependency) executes unfettered. Anti-clickjacking is also absent.
**Fix:** set headers in `vercel.json` (`headers` block) or a `_headers`/middleware; add `script-src 'self' https://accounts.google.com; object-src 'none'; frame-ancestors 'self'`.

### D-3 · HIGH — Documentation materially overstates security posture
C1–C4, C5, C6, C11, C14 above. A reviewer reading the README would believe CSP, session ownership, and legacy mounts are all verified live. They are not.
**Impact:** governance/trust risk — precisely the class of defect an “elite” review must catch.
**Fix:** regenerate claim tables from live probes; mark capability-URL chat as an explicit exception; correct reset-limit and legacy-mount wording.

### D-4 · MEDIUM — User enumeration via response timing
Signin: existing email + wrong password ≈ 599/604 ms; unknown email ≈ 237 ms (Δ367 ms) — bcrypt only runs for real users. Forgot-password: existing ≈ 2,038 ms; unknown ≈ 407 ms (Δ1,631 ms) even though bodies are identical (IQ-21).
**Fix:** compare against a dummy bcrypt hash on the miss path; enqueue reset email asynchronously (or pad response time).

### D-5 · MEDIUM — Error envelope is inconsistent
`POST /api/v1/auth/signin` validation error omits `requestId` in the body (only header); other validation errors include it. Some errors carry `success:false`, some don’t; chat returns `details[]`, auth joins messages into a string (IQ-19).
**Impact:** clients cannot rely on one shape; observability loses correlation in exactly the cases you debug most.
**Fix:** route every error through `lib/respond.js#fail`.

### D-6 · MEDIUM — Unauthenticated paid-LLM surface
`POST /api/v1/chat` requires no account and consumes Gemini quota, guarded only by 10 req/min/IP (IQ-14). Distributed abuse can still burn budget.
**Fix:** require auth for LLM routes, or add a global daily spend cap.

### D-7 · MEDIUM — Bare legacy mount is dead in production
`src/app.js:175` mounts every router at both `/api/v1` and `/`; on Vercel only `/api/:path*` is rewritten, so `/nearby`, `/auth/me`, `/chat` 404 while `/api/nearby` works (IQ-28). The comment “both serve identical handlers” holds only for local `src/server.js`.
**Fix:** either delete the bare mount and fix the docs, or add explicit rewrites.

### D-8 · LOW/MEDIUM — Curated data is incomplete and OSM defaults look measured
`opening_hours` is null on all 60 curated rows; OSM rows are returned with hard-coded `price_tier:"mid"`, `spice_profile:"medium"`, `ambience:"casual"`, `dietary_options:["none"]` (`src/db/catalogue.js:12-36`). `docs/DATA.md` admits the defaults, but the API does not mark them as unknown (unlike `saved_places`, which uses `*_source:"unknown"`).
**Fix:** emit `null`/`"unknown"` provenance for derived fields.

### D-9 · LOW — LLM reliability: 502s with no visible retry
2 of 8 LLM calls returned `502 UPSTREAM_FAILURE` (“The AI service is busy right now”) — including one safety probe (IQ-18, IQ-26).
**Fix:** retry once with jitter; surface a deterministic fallback (e.g. rule-based recommendations) rather than failing the turn.

### D-10 · LOW — Residual config smells
API CSP `connect-src` still lists `http://localhost:3000` in production (`src/app.js:40`); HTML/static assets are served with `Access-Control-Allow-Origin: *` (IQ-27); the rate-limit header is present but only the coarse API limiter’s value is exposed on auth routes (IQ-14).

### D-11 · INFO — Malformed-JSON 500 was a real bug, now fixed mid-audit
First probe (23:08) returned **500 `INTERNAL`** for `{bad json`; by 00:00 the same request returned **400 `VALIDATION_ERROR` “Malformed JSON body”** after the `a23986c` deploy (IQ-13, IQ-19). Keep a regression test.

---

## 4. Unverified (not scored, or scored conservatively)

1. **Admin success paths / RBAC** — no admin credential; only the 403 denial path was proven.
2. **Email + OTP delivery, password reset end-to-end** — SMTP not exercised (third-party).
3. **`DELETE /api/v1/auth/me` cascade** — not run; accounts were needed for cleanup confirmation.
4. **DB-down readiness 503**, pool exhaustion, failover.
5. **Backups / restore drill, alerting, Sentry** — own docs state Sentry is **not armed** (EVIDENCE F21-16).
6. **Rate limits at threshold** — not driven to 429 (gentle-test constraint); only headers/config observed.
7. **Sustained load / soak >20 users**, cold-start latency distribution.
8. **Google OAuth** — `features.google_auth:false` on `/health`; path inert.
9. **Service-worker offline behaviour** — static source read only, no real browser.
10. **Repo test suite pass state** — not executed (read-only scope).
11. **RLS / DB-level authorisation** — no database access.

---

## 5. Why this grading may be biased (three reasons)

1. **Black-box, single-tenant view.** No admin token, DB, CI, or Vercel dashboard. Operations and governance are scored on observable behaviour + docs, which structurally under-rewards controls that exist but are invisible (alerts, backups, RLS, CI gates).
2. **One deployment, one hour.** Two of eight LLM calls 502’d; a different window (or a rotated key) could move Reliability by a full point in either direction. The audit also straddled a redeploy that fixed the malformed-JSON 500, so timing changes results.
3. **Suite not run + account surplus.** Quality rests on `npm run build` and static reading, not on a green test run; and I used 3 accounts instead of 2, so multi-user state is slightly broader than the brief allowed.

---

## 6. Test-account inventory (cleanup needs your “yes”)

Created during the audit (passwords held only in the auditor’s temp workspace, not printed here):

| Handle | Email | Rows created |
|---|---|---|
| A | `audita_1792451307974@example.com` | 1 saved place (`6045b3d8…`), favorite `r009`, chat sessions |
| B | `auditb_1792451380577@example.com` | 6 saved places (XSS/SQLi fixtures), 2 reports (`NT-171JUR`, `NT-OWPWOP`…), 1 session |
| M | `mass_1792451393518@example.com` | none (signup probe; `role:"admin"` correctly ignored) |

**Per the brief I will not delete anything until you approve.** Say the word and I will `SELECT` each account’s rows, show you the output, and then delete via `DELETE /api/v1/auth/me`.

---

## 7. 30-minute self-check checklist (reproduce every claim)

```powershell
# 0. Which host is actually alive?
curl.exe -s -o NUL -w "%{http_code}`n" https://naijataste-ai.vercel.app/health      # expect 200
curl.exe -s -o NUL -w "%{http_code}`n" https://naijaaste-ai.vercel.app/health      # expect 404 DEPLOYMENT_NOT_FOUND

# 1. D-2 — document headers (the big one)
curl.exe -sI https://naijataste-ai.vercel.app/app/login | Select-String -Pattern "content-security-policy|x-frame-options|x-content-type-options"
#    expect: NO output

# 2. D-1 — chat session authz (needs two accounts; use the two created above)
#    A: POST /api/v1/chat -> grab session_id
#    B: GET /api/v1/chat/<id>   -> 200 means the defect is live
#    B: DELETE /api/v1/chat/<id> -> 200 means anyone can destroy it

# 3. D-4 — timing oracle
1..5 | ForEach-Object { Measure-Command { curl.exe -s -o NUL -X POST https://naijataste-ai.vercel.app/api/v1/auth/signin -H "content-type: application/json" -d '{\"email\":\"nobody@example.com\",\"password\":\"x\"}' } | Select-Object TotalMilliseconds }

# 4. C6 — reset limiter window (code, not live)
Select-String -Path src/routes/auth.routes.js -Pattern "resetLimiter" -Context 0,8

# 5. D-7 — legacy mount matrix
foreach ($p in '/nearby?lat=6.5&lng=3.3','/api/nearby?lat=6.5&lng=3.3','/auth/me','/api/auth/me') {
  "$p -> " + (curl.exe -s -o NUL -w "%{http_code}" "https://naijataste-ai.vercel.app$p")
}
#    expect: 404, 200, 404, 401

# 6. C7 — refresh replay (needs the cookie jar)
#    curl -c jar -X POST .../api/v1/auth/signin ...
#    curl -b jar -X POST .../api/v1/auth/refresh   # 200 + new cookie
#    curl -b jar(old) -X POST .../api/v1/auth/refresh  # expect 401 INVALID_REFRESH

# 7. D-8 — data completeness
node -e "const d=require('./src/data/restaurants.json');const a=Array.isArray(d)?d:Object.values(d);console.log('rows',a.length,'noHours',a.filter(r=>!r.opening_hours).length)"

# 8. Quality gate (optional, 10 min)
npm run lint ; npm run build ; npx vitest run
```

---

*Evidence IDs IQ-00 … IQ-28 are reproduced in `docs/EVIDENCE.md` under “Independent review evidence (2026-10-19/20)”. Raw probe scripts lived in `%TEMP%\opencode\audit\` and are intentionally outside the repo.*
