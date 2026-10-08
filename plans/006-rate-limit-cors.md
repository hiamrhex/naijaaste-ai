# Plan 006: Rate limiting + CORS allowlist (layer 1 + production configuration)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b739eff..HEAD -- src/app.js src/env.js .env.example package.json`
> Expected: changes from plans 001–005 only (exports/middleware in `app.js`,
> `src/env.js` created in 005 with `GROQ_API_KEY/PORT/NODE_ENV/LOG_LEVEL`).
> Re-anchor by symbol; changes beyond 001–005 scopes → STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (defaults preserve current CORS behavior; limits are
  generous and configurable; `/health` exempt from limiting)
- **Depends on**: plans/005-zod-contracts.md (env schema; transitively 003 for
  `req.id` + error shape)
- **Category**: security
- **Planned at**: commit `b739eff`, 2026-10-09

## Why this matters

Layer 1: there is **no rate limiting anywhere**. Every endpoint that reaches
`callLLMJson` spends real Groq quota, and `src/app.js:14` mounts `cors()` —
the default, which reflects **any** Origin with `Access-Control-Allow-Origin`.
The server is deployed publicly (hardcoded Railway URL in
`src/constants/index.js:3`), so anyone can script the API and burn the API
key's budget from any website, from any IP, indefinitely. This plan adds
two-tier rate limits (all routes vs. LLM routes) with standard draft-7 headers
and a 429 body in plan 003's error shape, plus a CORS origin allowlist driven
by env — with an explicit, logged fallback that preserves today's open behavior
until the operator sets `CORS_ORIGIN` in production.

## Current state

- `src/app.js` middleware stack today (after plans 003–005):

```js
app.use(express.json({ limit: "10kb" }));
app.use(cors());                    // ← reflects any Origin (line 14 as of b739eff)
app.use(requestId);                 // added by 003/004
// no rate limiter exists anywhere — verified: no 'rateLimit', 'express-rate-limit',
// or 'limit(' matches in src/
```

- `src/env.js` (created by 005) currently validates:

```js
const EnvSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
```

- Health endpoint `/health` (from `src/app.js`) is probed by deploy platforms —
  it must never be rate-limited (a probe storm would 429 the platform into
  marking the service unhealthy).
- Error shape (plan 003) to reuse for 429s:
  `{ success:false, error:{ code, message }, requestId }`; request id from
  `req.id` (plan 003 middleware).
- LLM-bound routes: `POST /chat`, `POST /extract-persona`,
  `POST /update-preference` (no LLM but same family), `POST /recommend`,
  `POST /generate-review`. (`/update-preference` is cheap but included for a
  simple, predictable rule.)
- Behind Railway, client IPs arrive via `X-Forwarded-For`; without
  `app.set('trust proxy', …)` Express sees the proxy's IP and **all users share
  one bucket**. Express also warns if `trust proxy` is trusted incorrectly —
  both are handled below.
- Frontend sends `fetch(..., { headers: { 'Content-Type': 'application/json' } })`
  only (`src/NaijaTasteAI.jsx:112-116`) — allowed headers must cover
  `Content-Type` (and `X-Request-Id` for future clients).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install express-rate-limit` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests | `npm test` | exit 0 |
| Open-CORS grep | `Select-String -Path src\app.js -Pattern 'cors\(\)'` | no matches |
| Boot smoke | plan 001 block (with `src/server.js`) | `HTTP 200` |

## Scope

**In scope** (the only files you should modify):
- `src/app.js` (limiters, CORS options, trust proxy)
- `src/env.js` (add 4 keys to the schema)
- `.env.example` (document the new keys)
- `package.json`, `package-lock.json` (express-rate-limit)
- `tests/limits.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- Route/service logic and response shapes (except the new 429 body, which is
  built inline in this plan using 003's shape).
- `src/middleware/requestId.js`, `src/lib/errors.js` (reuse only).
- Helmet/security headers (rejected in `plans/README.md` — not in the 25-layer set).
- Per-user/API-key quotas (no auth → IP-based only; revisit with layer 3-7 decision).

## Git workflow

- Branch: `master`; conventional commit, e.g.
  `feat: rate limiting and CORS origin allowlist`.
- Push after green (operator standing instruction); never push on failure.

## Steps

### Step 1: Install express-rate-limit

`npm install express-rate-limit` → exit 0.
**Verify**: `npm ls express-rate-limit --depth=0` → listed.

### Step 2: Extend `src/env.js` schema and `.env.example`

Add to `EnvSchema` (keep the existing four keys):

```js
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_LLM_MAX: z.coerce.number().int().positive().default(10),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().nonnegative().optional(),
```

Add to `.env.example` (append):

```
RATE_LIMIT_API_MAX=100
RATE_LIMIT_LLM_MAX=10
# CORS_ORIGIN=https://your-frontend.example.com (comma-separated for several)
# TRUST_PROXY=1  # set on Railway/behind a proxy so per-IP limits see real client IPs
```

**Verify**: `npm test` → still green (defaults keep existing behavior).

### Step 3: Mount limiters + CORS allowlist in `src/app.js`

Add imports:

```js
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { logger } from './lib/logger.js';
```

After the `requestId` middleware mount and **before** the routes, add:

```js
// Per-IP trust: only behind a real proxy (Railway) — see .env.example
if (env.TRUST_PROXY !== undefined) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// CORS allowlist — unset = today's open behavior, loudly logged (parity until
// the operator sets CORS_ORIGIN in production)
const allowedOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  logger.warn('CORS_ORIGIN not set — allowing requests from any origin');
}

app.use(
  cors({
    origin: allowedOrigins.length === 0 ? true : allowedOrigins,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit'],
  })
);
```

Replace the existing bare `app.use(cors());` with the block above (do not
mount cors twice).

Then define and mount the two limiters (right after CORS, before routes):

```js
const limiterHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    requestId: req.id,
  });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 minutes
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',   // probes never throttled
  handler: limiterHandler,
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,               // 1 minute
  limit: env.RATE_LIMIT_LLM_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limiterHandler,
});

app.use(apiLimiter);
app.use(
  ['/chat', '/extract-persona', '/update-preference', '/recommend', '/generate-review'],
  llmLimiter
);
```

Mount order matters: `requestId` first (so 429s carry `requestId`), then
CORS, then limiters, then routes.

**Verify**: `npm run lint` → 0; `Select-String -Path src\app.js -Pattern 'cors\(\)'`
→ no matches (bare call gone).

### Step 4: Tests — create `tests/limits.test.js`

Limits are read at module import from `env`, so this file sets its own env
**before** dynamically importing the app, and restores it afterward (vitest
isolates each file's module registry; the restore protects any worker reuse):

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const PREV = {
  RATE_LIMIT_API_MAX: process.env.RATE_LIMIT_API_MAX,
  RATE_LIMIT_LLM_MAX: process.env.RATE_LIMIT_LLM_MAX,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};

let app;

beforeAll(async () => {
  process.env.RATE_LIMIT_API_MAX = '3';
  process.env.RATE_LIMIT_LLM_MAX = '10';
  process.env.CORS_ORIGIN = 'https://allowed.example';
  ({ app } = await import('../src/app.js'));
});

afterAll(() => {
  for (const [k, v] of Object.entries(PREV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('rate limiting (layer 1)', () => {
  it('never throttles /health (probes exempt)', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).get('/health').expect(200);
    }
  });

  it('throttles general routes after RATE_LIMIT_API_MAX requests with a contract 429', async () => {
    // use GET /chat/:id (no LLM): 3 pass (404), 4th → 429
    await request(app).get('/chat/11111111-1111-4111-8111-111111111111').expect(404);
    await request(app).get('/chat/11111111-1111-4111-8111-111111111111').expect(404);
    await request(app).get('/chat/11111111-1111-4111-8111-111111111111').expect(404);
    const res = await request(app)
      .get('/chat/11111111-1111-4111-8111-111111111111')
      .expect(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});

describe('CORS allowlist (production config)', () => {
  it('reflects only allowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://allowed.example')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example');
  });

  it('does not grant CORS to disallowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
```

Ordering note: run the CORS describe **before** the throttle exhaustion if your
runner executes in file order — the throttle test consumes the `/health`
bucket… it does not (`/health` is skipped). The 404 test consumes the
**general** bucket; CORS assertions also hit `/health` (exempt) — safe either
way.

**Verify**: `npm test` → exit 0, all suites (≥ 27 tests total).

### Step 5: Manual verification

Boot with the plan-001 smoke block, then:

1. Throttle loop (PowerShell):

```powershell
1..6 | ForEach-Object { try { (Invoke-WebRequest -Uri http://localhost:3000/chat/11111111-1111-4111-8111-111111111111 -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ } }
```

Default `RATE_LIMIT_API_MAX=100` won't trip in 6 calls — instead run with
`$env:RATE_LIMIT_API_MAX='3'` before boot; expected: three `404`s then `429`.

2. CORS probe:

```powershell
try { Invoke-WebRequest -Uri http://localhost:3000/health -Headers @{ Origin = 'https://evil.example' } -UseBasicParsing } catch {}
# response headers must NOT contain access-control-allow-origin (CORS_ORIGIN unset → open mode logs a warning instead;
# with CORS_ORIGIN set to a value, evil origin gets no ACAO header)
```

**Verify**: 429 body matches the contract (`error.code: RATE_LIMITED`,
`requestId` present, `RateLimit-*` headers present); warning
`CORS_ORIGIN not set` appears in stdout when unset.

## Test plan

- New: `tests/limits.test.js` — health exemption, general-limit exhaustion with
  contract 429, allow/deny origin pair (5 tests).
- Existing suites must pass unchanged (env defaults keep old behavior; the
  test file restores env in `afterAll`).
- Verification: `npm test` → all green; lint → 0; boot smoke → 200.

## Done criteria

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 with ≥ 27 tests; new file green
- [ ] `Select-String -Path src\app.js -Pattern 'cors\(\)'` → no matches (open default gone from code)
- [ ] 429 response verified manually with `RATE_LIMIT_API_MAX=3` (contract body + RateLimit header)
- [ ] `/health` returns 200 for ≥ 5 consecutive probes while limits are armed
- [ ] `src/env.js` contains `RATE_LIMIT_API_MAX`, `RATE_LIMIT_LLM_MAX`, `CORS_ORIGIN`, `TRUST_PROXY`
- [ ] `.env.example` documents all four
- [ ] Boot smoke returns `HTTP 200`; startup logs warn while `CORS_ORIGIN` unset
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Committed and pushed (operator standing instruction) or reported green
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 005's `env.js` differs from the excerpt (missing keys/schema shape) —
  this plan appends to it and depends on its parse-once behavior.
- Plan 003's `req.id` is not available on the 429 path (test fails on
  `requestId`) — middleware ordering drifted; STOP.
- express-rate-limit's API differs from the snippets (breaking major) —
  STOP and report the version rather than guessing option names.
- express-rate-limit prints validation warnings that fail tests (e.g. proxy
  header complaints in CI) — try the documented `validate` opt-out only if it
  is a one-liner; if the output still fails a gate, STOP and report.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- **Set these in production**: `CORS_ORIGIN=https://<frontend-host>` and
  `TRUST_PROXY=1` on Railway — without them, open-CORS remains (warned) and
  per-IP buckets key on the proxy IP (all users share one bucket). This is the
  one operational follow-up the code cannot do for you.
- Tune limits via env, not code: raise `RATE_LIMIT_API_MAX` if the health
  probes + judges share a NAT and trip 100/15min.
- The deploy platform's own health probes must be excluded from any *external*
  aggregator hitting `/health` aggressively — `skip` covers in-process cases.
- A reviewer should check: limiter mounts sit between `requestId` and routes;
  429 body matches the 003 contract exactly; no route lost its handlers.
- Deferred: per-route LLM budgets keyed by session id (needs the auth decision
  from `plans/README.md` layers 3-7 first).
