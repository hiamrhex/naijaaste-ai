# Architecture

> Last verified: 2026-10-16 against `src/` + `migrations/`. If code and doc disagree, code wins — open an issue.
> Diagrams: [README](../README.md#architecture) · full ER + deployment topology there.

## Components

| Component | Responsibility | Key files |
|---|---|---|
| SPA shell | BrowserRouter (`/app` basename), lazy screens, guards (auth/admin), theme/auth/language providers | `src/app/`, `src/screens/`, `src/components/TabBar.jsx` |
| Landing | Zero-dependency static front door at `/` | `index.html`, `public/landing.css`, `public/landing.js` |
| API + middleware | helmet/CORS/cookies → JSON limits → requestId → rate limiters → routers → 404 → errorHandler | `src/app.js`, `src/middleware/` |
| Agent loop | Up-to-6-step ReAct over 4 whitelisted tools, trace per turn | `src/agent/` |
| Services | Chat sessions, persona/recommend/review LLM calls, SMTP email, Places cache | `src/services/` |
| Stores | Users, OTP, sessions, ratings, reports, catalogue — one SQL surface | `src/auth/store.js`, `src/auth/otp.js`, `src/services/chat.service.js`, `src/ratings/`, `src/reports/`, `src/db/catalogue.js` |
| DB layer | Dual driver (Neon/pg-mem), migrations runner, catalogue seed | `src/db/`, `migrations/` |
| Serverless entry | Strips `/api` prefix, dispatches to Express without `listen` | `api/index.js`, `vercel.json` |

## Request lifecycle

1. Vercel rewrites `/api/*` → function (or Vite dev proxy → `:3000`).
2. `api/index.js` strips `/api`, Express matches `/api/v1/*` (canonical). The legacy bare mounts also exist when `src/server.js` runs directly, but on the deployment they are not reachable (`404`).
3. `apiLimiter` (all but `/health`) → `llmLimiter` (6 LLM paths, both mounts) → zod `validate()` → handler.
4. Handler: `ok()` → `{ data, meta? }`; throws → `errorHandler` → `{ error: { code, message, details?, requestId } }` (+ `Retry-After` on 429).
5. Every response carries `X-Request-Id` (accepted from client or generated).

## Failure modes

| Dependency fails | Behavior | User sees |
|---|---|---|
| Gemini slow/down | `callLLMJson` throws → 502 `UPSTREAM_FAILURE`, no message leak | "Upstream LLM request failed" + requestId |
| Neon unreachable | Route handlers throw → 500 `INTERNAL` (logged with stack) | Generic error + requestId |
| SMTP down/misconfigured | Fail-closed neutral message; prod logs alert, never `dev_otp` | "If that account exists, a reset code has been sent." |
| Overpass down | Import aborts per city with `OSM_FETCH_FAILED`; catalogue keeps serving | Nothing (background job; cron retries daily) |
| Oversized body | 413 `PAYLOAD_TOO_LARGE` (10kb; 350kb on `/reports`) | Honest limit message |
| Malformed JSON | 400 `VALIDATION_ERROR` | "Malformed JSON body" |

## Scaling limits and first bottlenecks

1. **Single Node process** — no clustering; one event loop for all requests. First bottleneck under concurrent load.
2. **Neon free tier** — 0.25–2 CU autoscale, 104 direct connections (pooler recommended), 1 GB storage, 5 GB egress/mo, 6h PITR window. Pool is `max: 3` by design.
3. **Vercel Hobby** — 300s max duration, 4.5MB bodies, single region; LLM retries budgeted inside 60s function config.
4. **Full-table catalogue scans** — mitigated by city/box/code pushdowns + indexes (`city`, `coords`, `code`); at 100k+ rows, add `EXPLAIN ANALYZE` review and keyset pagination on lists (ratings/admin reports already unbounded — known gap).
5. **bcrypt cost 12** — ~250ms per signup/signin by design; rate-limited endpoints absorb it.
