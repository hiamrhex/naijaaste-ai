# Plan — NaijaTaste AI (RAISE, T2)

> Generated 2026-10-22. Per distinguished-systems §6 Phase 2.
> Ordered work packages with goal, why, evidence of done, risk, rollback.

## Priority Order (Security & Data Integrity → Reliability & Blast Radius → Operability → Quality → Polish)

---

### WP-01: Arm Monitoring & Alerting (Security / Operations)

**Goal:** Sentry error tracking + uptime monitor on `/health` + SLO burn alerts.

**Why:** System is live with zero visibility (MATURITY top-5 risk #1). Independent review: Operations=1.

**Evidence of Done:**
- `SENTRY_DSN` set in Vercel project; test event appears in Sentry
- UptimeRobot/BetterStack free monitor on `GET /health` (30s interval) with alert to email/Telegram
- Sentry captures 5xx with `requestId` tags; PII redacted (already in code)
- Alert rule: 5xx rate > 1% over 5m → page

**Risk:** Low. Config-only. No code change.

**Rollback:** Unset `SENTRY_DSN` in Vercel; delete monitor.

---

### WP-02: Fix Canonical `/api/v1/*` Contract (Reliability / Architecture)

**Goal:** `/api/v1/*` paths work on production (currently 404 — AUDIT F1, INDEPENDENT D-7).

**Why:** Documented API contract broken for external clients, uptime checks, partners. SPA works via undocumented `/api/*`.

**Evidence of Done:**
- `GET /api/v1/auth/me` → 200 (authenticated) or 401
- `GET /api/v1/nearby` → 200
- `POST /api/v1/chat` → 200
- All 27 ENDPOINTS from `app.js:86-119` reachable at `/api/v1/*`
- Legacy `/api/*` still works (SPA unchanged)

**Risk:** Medium. Touches `api/index.js` prefix stripping logic and `vercel.json` rewrites.

**Rollback:** Revert `api/index.js` and `vercel.json`; Vercel promote previous deployment.

---

### WP-03: Chat Session Auth & Ownership (Security — HIGH)

**Goal:** `GET/DELETE /api/v1/chat/:sessionId` require auth or capability; ownership enforced (INDEPENDENT D-1).

**Why:** Current capability-URL design allows any holder of a session_id to read/delete another user's conversation. Docs claim 403/404 — false.

**Evidence of Done:**
- `GET /chat/:id` with valid user token → 200 iff owner; 404 otherwise
- `GET /chat/:id` with valid capability → 200 iff holder; 404 otherwise
- `DELETE /chat/:id` same rules
- No token → 401; foreign token → 404; wrong capability → 404
- Session creation: `POST /chat` sets `user_id` when authenticated, capability when anonymous
- Regression test: `tests/chat-ownership.test.js` covers all cases on both mounts

**Risk:** Medium. Changes `chat.service.js` ownership logic and `chat.routes.js` (already has checks but `user_id` not set on creation for auth users).

**Rollback:** Revert `chat.service.js` and `chat.routes.js`; sessions table unchanged.

---

### WP-04: Document Security Headers (Security — HIGH)

**Goal:** CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy on all HTML/JS documents served by Vercel (INDEPENDENT D-2).

**Why:** Helmet only covers Express responses. Static assets (`/`, `/app/*`, `/sw.js`, `/offline.html`) served by Vercel edge bypass Helmet entirely. CSP absent on the SPA the browser actually executes.

**Evidence of Done:**
- `vercel.json` `headers` block with rules for `/:path((?!api/).*)` and `/sw.js`, `/offline.html`, `/offline.js`
- Live header scan: 5/5 headers present on `/`, `/app/login`, `/sw.js`, `/offline.html`, `/offline.js`
- CSP: `script-src 'self' https://accounts.google.com; object-src 'none'; frame-ancestors 'self'` (no `unsafe-inline`)
- API keeps exactly one CSP (Helmet's) — no duplication

**Risk:** Low. Config-only (`vercel.json`). Already prototyped in IR-04/IR-05 (proven locally).

**Rollback:** Revert `vercel.json` headers block; Vercel promote previous deployment.

---

### WP-05: Close Timing Oracle on Auth (Security — MEDIUM)

**Goal:** Signin and forgot-password timing parity within noise (INDEPENDENT D-4).

**Why:** Signin: known email ~600ms vs unknown ~237ms (Δ367ms). Forgot-password: known ~2038ms vs unknown ~407ms (Δ1631ms). Bcrypt only runs for real users.

**Evidence of Done:**
- `probes/auth-timing-probe.mjs 50` → p50 delta < 10ms, distributions overlap > 80%
- Signin: compare against dummy hash on miss path (already in `auth.routes.js:89` but verify it's hit)
- Forgot-password: always issue code + call mailer (sink for unknown); async email send or pad response
- Unit test: `tests/auth-timing.test.js` asserts statement counts equal for known vs unknown

**Risk:** Low. Logic already partially implemented; need to verify and close forgot-path gap.

**Rollback:** Revert `auth.routes.js` forgot-password handler.

---

### WP-06: SLO Measurement & Burn Alerting (Reliability)

**Goal:** Continuous p95 latency and AI success rate computation; alert at 50% error budget.

**Why:** SLOs defined in docs but **nothing computes or alerts** (AUDIT check 16, MATURITY risk #3). SLOs are targets held by review, not enforced by machinery.

**Evidence of Done:**
- Log pipeline: pino structured logs → aggregation (e.g., BetterStack/Loki free tier or custom Cloudflare Worker) → rolling p95 per SLI
- Dashboard: availability (30d), non-AI latency p95 (7d), AI latency p95 (7d), AI success rate (7d)
- Alert: burn rate > 2x budget over 1h → notification
- Error budget policy enforced: 50% spent → freeze features; 100% → only reliability work

**Risk:** Medium. Requires observability pipeline setup (can use free tier BetterStack or similar).

**Rollback:** Disable alerts; keep dashboard for manual review.

---

### WP-07: Neon Branch PITR Restore Drill (Data / Reliability)

**Goal:** Verify Neon branch point-in-time restore with timings (AUDIT check 20, MATURITY risk #5).

**Why:** Logical restore PASS (2026-10-16) but **branch PITR untested** — runbook recovery path unproven. Needs Neon API key.

**Evidence of Done:**
- Neon API key obtained (operator action)
- Branch created from production at known timestamp
- `pg_restore` into branch → row counts identical → branch deleted
- Timings recorded: branch create, restore, verify
- Runbook updated with verified steps

**Risk:** Low. Read-only drill on copy. Requires operator Neon access.

**Rollback:** Delete test branch; no production impact.

---

### WP-08: Error Envelope Consistency (Quality / Reliability)

**Goal:** Every error response has identical shape: `{ success: false, error: { code, message, requestId?, details? } }` (INDEPENDENT D-5).

**Why:** Signin validation omits `requestId` in body (header only). Some errors carry `success:false`, some don't. Chat returns `details[]`, auth joins messages.

**Evidence of Done:**
- Single `fail()` in `lib/respond.js` used by all routes
- `failAuth` in `auth.routes.js` refactored to use `fail()`
- Validation errors, 404, 429, 500 all same shape
- Regression test: `tests/errors.test.js` asserts envelope on every error class

**Risk:** Low. Refactoring with test coverage.

**Rollback:** Revert `lib/respond.js` and route handlers.

---

### WP-09: Auth-Gate Unauthenticated LLM Surface (Security — MEDIUM)

**Goal:** `POST /api/v1/chat` requires authentication (or add global daily spend cap) (INDEPENDENT D-6).

**Why:** Anonymous chat consumes Gemini quota, guarded only by 10 req/min/IP. Distributed abuse can burn free tier in a day.

**Evidence of Done:**
- `requireAuth` middleware on `/chat` (and `/agent`, `/recommend`, `/extract-persona`, `/generate-review`)
- Anonymous users get 401 `UNAUTHENTICATED` before provider call
- Per-user LLM budget tracked (future) or global daily cap with alert at 70%

**Risk:** Medium. Breaking change for anonymous chat UX. May need product decision.

**Rollback:** Remove `requireAuth` from LLM routes; restore anonymous access.

---

### WP-10: Data Quality Gates & Provenance (Data / Quality)

**Goal:** `data/ng/*` catalogues have zero duplicate keys, 100% resolved `source_refs`, `opening_hours` provenance marked (AUDIT F6, INDEPENDENT D-8).

**Why:** 17 duplicate keys + 40 unresolved `source_refs` ship with checker exiting 0. OSM defaults (`price_tier:"mid"`, `spice_profile:"medium"`) look measured.

**Evidence of Done:**
- `scripts/check-ng-data.mjs` exits non-zero on warnings (duplicates, unresolved refs)
- Duplicate keys merged (Lagos|Eti-Osa ×7, Abuja|AMAC ×7, etc.)
- All `source_refs` resolve to `data/ng/sources.md` registry
- `opening_hours: null` emitted as `"unknown"` provenance in API (like saved-places `*_source:"unknown"`)
- CI gate `check:ng-data` blocks merge on any warning

**Risk:** Low. Data migration + script fix. Already prototyped in F21-08/F21-09.

**Rollback:** Revert data files and checker script.

---

### WP-11: LLM Retry + Deterministic Fallback (Reliability)

**Goal:** Retry once with jitter on 502/503; surface deterministic fallback instead of failing turn (INDEPENDENT D-9).

**Why:** 2/8 LLM calls returned `502 UPSTREAM_FAILURE` with no retry/fallback observed. Chat has no fallback (recommend does).

**Evidence of Done:**
- `callLLMJson` retries once on 429/5xx with exponential backoff + jitter
- `/chat` gets deterministic fallback (catalogue-based) when model fails
- Fallback returns `meta.fallback=true`, honest message, real restaurant names
- Circuit breaker still protects quota

**Risk:** Low. Extends existing `llm.service.js` resilience patterns.

**Rollback:** Revert `llm.service.js` and `chat.service.js`.

---

### WP-12: Rate-Limit Header De-duplication (Reliability / Quality)

**Goal:** Single `RateLimit` header per response (AUDIT F4).

**Why:** Two stacked limiters (`apiLimiter` limit=600, `authLimiter` limit=20) both emit draft-7 headers on same response — clients can't parse intent.

**Evidence of Done:**
- Only the most specific limiter emits headers (LLM paths: `llmLimiter`; auth paths: `authLimiter`; others: `apiLimiter`)
- Header scan shows one `RateLimit` per response
- `standardHeaders: 'draft-7'` on chosen limiter only

**Risk:** Low. Middleware ordering change.

**Rollback:** Revert `app.js` limiter mounting.

---

### WP-13: Docs Drift Repair (Governance)

**Goal:** All claims in README, SECURITY.md, THREAT_MODEL.md, API.md match live system (INDEPENDENT D-3, AUDIT F5).

**Why:** CSP claimed enforced → false on SPA. Session ownership claimed tested → false for chat. Legacy `/` mount claimed identical → false on Vercel. Reset limiter claimed 10/min → actually 10/15min. Deploy URL stale (`naijaaste` vs `naijataste`).

**Evidence of Done:**
- README: CSP claim removed/qualified; test badge dynamic (GitHub Actions shield); deploy URL corrected; legacy mount note clarified
- SECURITY.md: CSP row updated; session ownership qualified (capability-URL for chat); reset limit corrected
- THREAT_MODEL.md: E1 entry updated; chat session capability design documented as explicit exception
- API.md: canonical paths verified live; legacy paths marked Vercel-only
- `npm run check:docs` passes (links, scripts, Mermaid, numbers)

**Risk:** Low. Documentation only.

**Rollback:** Revert doc files.

---

### WP-14: Saved-Places UX Completion (Quality / Product)

**Goal:** Full CRUD on saved-places with honest limits (AUDIT F2, F3).

**Why:** DELETE added (F21-05) but: 150-char name silently truncated to 100 (T19-10); hostile names stored verbatim (T19-09, latent XSS risk for email/admin); 50-cap enforced in transaction (F21-06) but frontend delete button needed (F21-07).

**Evidence of Done:**
- Name limit: 100 chars enforced in schema + UI (`maxLength=100`); 400 on exceed
- Input sanitization: hostile chars escaped on render (React text nodes safe); `escapeHtml` if ever emailed
- Frontend: per-spot trash button + confirmation; 404 "already gone" handled
- Cap: transaction with `FOR UPDATE` prevents race (already in F21-06)

**Risk:** Low. Frontend + validation tweaks.

**Rollback:** Revert frontend and validation.

---

### WP-15: Residual Config Smells (Quality)

**Goal:** Clean production config (INDEPENDENT D-10).

**Why:** API CSP `connect-src` lists `http://localhost:3000` in production; static assets served with `Access-Control-Allow-Origin: *`; rate-limit header only coarse API limiter on auth routes.

**Evidence of Done:**
- `connect-src`: `http://localhost:3000` only in development
- Static assets: CORS headers removed or restricted to `CORS_ORIGIN`
- Auth routes expose their specific limiter headers

**Risk:** Low. Config only.

**Rollback:** Revert `app.js` and `vercel.json`.

---

## Dependencies & Sequencing

```
WP-01 (monitoring) ──┐
WP-02 (canonical)    ├── Can run in parallel (independent)
WP-04 (doc headers)  │
WP-03 (chat auth)    ├── WP-02 first (canonical paths must work for tests)
WP-05 (timing)       │
WP-08 (errors)       │
WP-12 (ratelimit)    │
WP-06 (SLO)          ├── WP-01 first (needs monitoring pipeline)
WP-07 (PITR)         │   (operator Neon access)
WP-09 (LLM auth)     ├── WP-03 first (auth patterns established)
WP-10 (data)         ├── Independent
WP-11 (LLM fallback) ├── WP-09 first (authenticated LLM routes)
WP-13 (docs)         ├── All fixes done (docs reflect reality)
WP-14 (saved-places) ├── Independent
WP-15 (config)       └── Independent
```

## Stop Gates

After each WP: run full local gate (`npm run lint && npm run build && npm run test:all && npm run scan:secrets && npm run check:docs && npm run check:ng-data`). If red → stop, fix, re-run. No push red.

For WP-02, WP-03, WP-04, WP-09 (production-affecting): wait for explicit "yes" before deploy.

## Cost & Risk Summary

| WP | Est. Effort | Risk | Blocks |
|---|---|---|---|
| 01 | 1-2h | Low | — |
| 02 | 2-4h | Medium | 03, 08, 09 |
| 03 | 3-5h | Medium | — |
| 04 | 1-2h | Low | — |
| 05 | 2-3h | Low | — |
| 06 | 4-8h | Medium | 01 |
| 07 | 2-4h | Low | (operator) |
| 08 | 2-3h | Low | 02 |
| 09 | 2-3h | Medium | 03 |
| 10 | 2-4h | Low | — |
| 11 | 3-5h | Low | 09 |
| 12 | 1-2h | Low | — |
| 13 | 2-3h | Low | all |
| 14 | 2-3h | Low | — |
| 15 | 1-2h | Low | — |

**Total: ~30-55h** for T2 production-grade baseline.