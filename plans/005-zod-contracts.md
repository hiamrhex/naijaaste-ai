# Plan 005: Zod contracts — fail-fast env (layer 18) + request validation (layer 2)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b739eff..HEAD -- src/app.js src/server.js src/evaluate.js src/services/llm.service.js src/services/persona.service.js src/routes src/middleware src/lib package.json .env.example`
> Expected: changes from plans 001–004 only (exports, middleware, error
> conversion in routes, logging swaps). Re-anchor by symbol, not line number;
> changes beyond 001–004 scopes → STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (validation messages preserved; one intentional strictness:
  `signal.rating` must be an integer — the message already promised "integer 1-5")
- **Depends on**: plans/003-error-contract.md (uses `badRequest`/`ApiError`;
  001/002 transitively)
- **Category**: security
- **Planned at**: commit `b739eff`, 2026-10-09

## Why this matters

Layer 2: every request body is validated by scattered, hand-rolled checks with
**three different required-field lists**, no type checking (a `rating` of `4.5`
or `message: 123` sails through some paths), and a route/service threshold
mismatch (`raw_text` ≥10 at the route, ≥5 in the service). Layer 18: config
fail-late — a missing `GROQ_API_KEY` surfaces as a cryptic SDK error (or a
mid-request failure), `PORT=abc` explodes at `listen`, and there is no env
schema at all. This plan introduces **one zod dependency serving both layers**:
an env module that validates and freezes config at boot (exit 1 with field
messages, never dumping values), and schema-first request validation wired
through plan 003's error helpers.

## Current state

- `process.env` reads (verified — exactly two in the whole server):

```js
// src/app.js:10 — after plan 002 this moved to src/server.js
const PORT = process.env.PORT || 3000;
// src/services/llm.service.js:3 — eager client, no validation
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
```

- `.env.example` (complete file):

```
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
```

- Env-load ordering bug: `src/evaluate.js` imports services (lines 9-10) **then**
  `import "dotenv/config"` (line 11) — ESM evaluates imports in declaration
  order, so `llm.service.js:3` constructs the Groq client **before** dotenv runs.
  It only works when the key is already in the process environment.
- Validation today (all in-route, all manual, divergent):

```js
// src/routes/chat.routes.js:12 — presence + type only, no max length (service guards 500)
if (!message || typeof message !== 'string' || message.trim().length < 1) { ... }

// src/routes/persona.routes.js:12
if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length < 10) { ... }
// vs src/services/persona.service.js:89 — the same input, different threshold:
if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 5) { ... }

// src/routes/persona.routes.js:69 — allows 4.5 (message says "integer 1-5")
if (signal.rating < 1 || signal.rating > 5) { ... }

// src/routes/recommend.routes.js:18 — required list A
const required = ['persona_id', 'city', 'budget_level', 'spice_tolerance', 'ambience_preference'];
// src/routes/review.routes.js:18-19 — required lists B and C
const requiredPersona = ['persona_id', 'city', 'budget_level', 'spice_tolerance'];
const requiredRestaurant = ['restaurant_id', 'name', 'city', 'ambience', 'spice_profile'];
```

- `src/routes/persona.routes.js:54` also requires
  `['dimension', 'value', 'rating']` (list D).
- After plan 003 all validation failures go through
  `badRequest(message, details)` from `src/lib/errors.js`
  (`details` = array of `{ path, message }` — reuse it for zod issues).
- Success-response fields are a frontend contract — schemas must validate the
  **inputs** only; handlers keep building responses exactly as they do.
- `src/app.js:1` still has `import "dotenv/config";` (to be removed — env.js
  becomes the single loader).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install zod` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests | `npm test` | exit 0 |
| Fail-fast smoke | see Step 6 | exit code 1, message names `GROQ_API_KEY` |
| Boot smoke | plan 001 block (with `src/server.js`) | `HTTP 200` |

## Scope

**In scope** (the only files you should modify):
- `src/env.js` (create), `src/schemas/index.js` (create),
  `src/middleware/validate.js` (create)
- `src/app.js` (drop `dotenv/config` import), `src/server.js` (use `env.PORT`),
  `src/evaluate.js` (line 11 dotenv → env import), `src/services/llm.service.js`
  (use `env.GROQ_API_KEY`), `src/services/persona.service.js` (threshold const),
  `src/lib/logger.js` (LOG_LEVEL line only)
- `src/routes/*.js` (4 files — replace manual checks with `validate(...)` only)
- `.env.example`, `package.json`, `package-lock.json`
- `tests/validation.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- Response shapes and status codes (003 owns the contract).
- `GROQ_MODEL` / making the model configurable — hardcoded at
  `src/services/llm.service.js:5`; deferred (maintenance note below).
- Any `.jsx` file; `src/constants/**`; `src/evaluate.js` beyond line 11.
- The 500-char guard inside `processChat` (`chat.service.js:76-82`) — stays as
  a defense-in-depth layer below the HTTP boundary; do not remove it.

## Git workflow

- Branch: `master`; conventional commit, e.g.
  `feat: zod contracts for env config and request validation`.
- Push after green (operator standing instruction); never push on failure.

## Steps

### Step 1: Install zod

`npm install zod` → exit 0. Note the installed major (`npm ls zod`) — the
snippets use `safeParse` + `error.issues`, present in both v3 and v4.

**Verify**: `npm ls zod --depth=0` → lists the package.

### Step 2: Create `src/env.js` — the single config source (layer 18)

```js
import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with field names only — never echo values (they may be secrets).
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
```

(Bootstrap `console.error` here is deliberate: the structured logger cannot be
trusted until config validates; this is the one sanctioned console in server
code post-004.)

### Step 3: Wire every entry point and env reader

1. `src/services/llm.service.js` — replace line 3:

```js
import { env } from '../env.js';
const groq = new Groq({ apiKey: env.GROQ_API_KEY });
```

   Because the *service* imports `env`, dotenv+validation run before the client
   constructs regardless of entry point — kills the evaluate.js ordering bug
   structurally.

2. `src/server.js` — first lines:

```js
import { env } from './env.js';
import { app } from './app.js';
...
const PORT = env.PORT;
```

3. `src/evaluate.js` — replace line 11 `import "dotenv/config";` with
   `import './env.js';` (position may stay; transitive import in the service
   already guarantees order — this makes the intent explicit).

4. `src/app.js` — delete line 1 `import "dotenv/config";` (env.js is the only
   loader now; `app.js` itself reads no env after plan 002).

5. `src/lib/logger.js` — change `process.env.LOG_LEVEL || 'info'` to
   `env.LOG_LEVEL` (add `import { env } from '../env.js';`).

**Verify**: `npm run lint` → 0; `npm test` → all pass (vitest env provides a
dummy `GROQ_API_KEY`, so schema passes).

### Step 4: Create `src/schemas/index.js`

One module, one vocabulary (fields mirror today's required lists exactly — no
loosening, no tightening beyond the integer rule):

```js
import { z } from 'zod';

export const MIN_RAW_TEXT = 10;

// Loosely typed pass-through: LLM-extracted personas are open-ended objects.
export const personaSchema = z.object({
  persona_id: z.string().min(1),
  city: z.string().min(1),
  budget_level: z.string().min(1),
  spice_tolerance: z.string().min(1),
  ambience_preference: z.string().min(1),
}).passthrough();

export const restaurantSchema = z.object({
  restaurant_id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  ambience: z.string().min(1),
  spice_profile: z.string().min(1),
}).passthrough();

export const chatBodySchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(500),
  session_id: z.string().uuid().optional(),
});

export const extractPersonaSchema = z.object({
  raw_text: z.string().trim().min(MIN_RAW_TEXT, 'raw_text is required and must be at least 10 characters'),
});

export const extractReviewSchema = z.object({
  persona: personaSchema,
  restaurant: restaurantSchema,
});

export const recommendSchema = z.object({
  persona: personaSchema,
});

export const updatePreferenceSchema = z.object({
  persona: z.object({ preference_history: z.array(z.any()).optional() }).passthrough(),
  signal: z.object({
    dimension: z.string().min(1),
    value: z.string().min(1),
    rating: z.number().int('signal.rating must be between 1 and 5').min(1, 'signal.rating must be between 1 and 5').max(5, 'signal.rating must be between 1 and 5'),
    restaurant_id: z.string().optional(),
  }),
});
```

Notes driving these choices:
- `personaSchema` requires the same five keys the routes required (list A/B) —
  but `review.routes` needed only four persona keys; five covers both (adding
  `ambience_preference` to generate-review's persona check is a **superset** of
  today's check… **not acceptable** — it would reject requests that pass
  today). Fix: split — `reviewPersonaSchema` = the four keys
  (`persona_id, city, budget_level, spice_tolerance`), `personaSchema` = five
  for recommend. Implement that split (two schemas), so behavior is exactly
  parity per endpoint.
- `session_id` as `uuid()` matches how it is generated (`uuidv4`) — and the
  route never uses non-uuid ids; if an existing client sends a non-uuid
  `session_id`, it now 400s (strictness is the point; note in report).
- `updatePreferenceSchema.persona` only constrains `preference_history`'s
  presence-optional shape — everything else passes through (route reads
  `persona.preference_history` and spreads `...persona`).

### Step 5: Create `src/middleware/validate.js` and rewire routes

```js
import { badRequest } from '../lib/errors.js';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(
      badRequest(
        'Request validation failed',
        result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }))
      )
    );
  }
  req.body = result.data;   // trimmed/coerced values replace the raw body
  next();
};
```

Rewire each route (keep handlers, catches, and status mapping from 003
untouched):

| Route file | Middleware | Manual checks to delete |
|------------|-----------|-------------------------|
| `chat.routes.js` POST `/chat` | `validate(chatBodySchema)` | lines with `!message || typeof…` (003 converted it to `next(badRequest(...))`) |
| `persona.routes.js` `/extract-persona` | `validate(extractPersonaSchema)` | `!raw_text || … < 10` block |
| `persona.routes.js` `/update-preference` | `validate(updatePreferenceSchema)` | presence + missing-fields + rating-range blocks (all three) |
| `review.routes.js` `/generate-review` | `validate(extractReviewSchema)` | both `requiredX.filter(...)` blocks |
| `recommend.routes.js` `/recommend` | `validate(recommendSchema)` | persona presence + required-fields block |

Shape: `router.post('/chat', validate(chatBodySchema), async (req, res, next) => {…})`.
Handlers then read `req.body` (already trimmed by zod — drop any remaining
`.trim()` calls in the rewired bodies, e.g. `message.trim()` → `message`).

In `src/services/persona.service.js`: change line 89's `< 5` to
`< MIN_RAW_TEXT` with `import { MIN_RAW_TEXT } from '../schemas/index.js';`
(route and service now share one threshold).

**Verify**: `npm run lint` → 0; `(Select-String -Path src\routes\*.js -Pattern 'safeParse|\.filter\(f =>').Count`
→ manual `required*` filter patterns gone; `npm test` → all pass.

### Step 6: Fail-fast smoke (layer 18)

PowerShell (runs server with an empty key — must exit 1 **before** listen):

```powershell
$env:GROQ_API_KEY = ''
node src/server.js
"exit: $LASTEXITCODE"
```

POSIX: `GROQ_API_KEY= node src/server.js; echo "exit: $?"`

**Verify**: prints `Invalid environment configuration:`, a line naming
`GROQ_API_KEY` (no value echoed), `exit: 1`. (dotenv does not override an
existing-but-empty var, so this holds even when a `.env` file exists.)

### Step 7: `.env.example` update

Add under the existing two lines:

```
NODE_ENV=development
LOG_LEVEL=info
```

**Verify**: `Get-Content .env.example` → four keys + the original comment-free style.

### Step 8: Contract tests — create `tests/validation.test.js`

```js
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import request from 'supertest';
import { chatBodySchema, extractPersonaSchema, updatePreferenceSchema, MIN_RAW_TEXT } from '../src/schemas/index.js';

describe('request schemas (layer 2)', () => {
  it('chat: accepts a plain message, trims it', () => {
    const r = chatBodySchema.safeParse({ message: '  hello  ' });
    expect(r.success).toBe(true);
    expect(r.data.message).toBe('hello');
  });

  it('chat: rejects empty, non-string, and >500-char messages', () => {
    expect(chatBodySchema.safeParse({}).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 123 }).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
  });

  it('chat: rejects malformed session_id', () => {
    expect(chatBodySchema.safeParse({ message: 'hi', session_id: 'not-a-uuid' }).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 'hi', session_id: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
  });

  it(`extract-persona: enforces MIN_RAW_TEXT (${MIN_RAW_TEXT})`, () => {
    expect(extractPersonaSchema.safeParse({ raw_text: 'short' }).success).toBe(false);
    expect(extractPersonaSchema.safeParse({ raw_text: 'x'.repeat(MIN_RAW_TEXT) }).success).toBe(true);
  });

  it('update-preference: rating must be an integer 1-5 (4.5 rejected)', () => {
    const base = { persona: { preference_history: [] }, signal: { dimension: 'spice', value: 'hot', rating: 4.5 } };
    expect(updatePreferenceSchema.safeParse(base).success).toBe(false);
    expect(updatePreferenceSchema.safeParse({ ...base, signal: { ...base.signal, rating: 4 } }).success).toBe(true);
    expect(updatePreferenceSchema.safeParse({ ...base, signal: { ...base.signal, rating: 6 } }).success).toBe(false);
  });
});

describe('HTTP validation failures use the 003 contract', () => {
  it('POST /chat with non-string message → 400 VALIDATION_ERROR + details path', async () => {
    const res = await request(app).post('/chat').send({ message: 42 }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.details?.[0]?.path).toBe('message');
  });

  it('POST /extract-persona with short raw_text → 400 with path raw_text', async () => {
    const res = await request(app).post('/extract-persona').send({ raw_text: 'no' }).expect(400);
    expect(res.body.details?.[0]?.path).toBe('raw_text');
  });

  it('POST /recommend missing persona → 400 with path persona', async () => {
    const res = await request(app).post('/recommend').send({}).expect(400);
    expect(res.body.details?.[0]?.path).toBe('persona');
  });

  it('POST /update-preference with rating 4.5 → 400 (integer enforced)', async () => {
    const res = await request(app)
      .post('/update-preference')
      .send({ persona: { preference_history: [] }, signal: { dimension: 'spice', value: 'hot', rating: 4.5 } })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('fail-fast env (layer 18)', () => {
  it('exits 1 with a field-level message when GROQ_API_KEY is empty', () => {
    let out = '';
    let status = 0;
    try {
      execFileSync(process.execPath, ['src/server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, GROQ_API_KEY: '' },
        stdio: 'pipe',
      });
    } catch (e) {
      status = e.status;
      out = String(e.stderr);
    }
    expect(status).toBe(1);
    expect(out).toContain('GROQ_API_KEY');
    expect(out).not.toContain(process.env.GROQ_API_KEY); // never echo the real value if present
  });
});
```

Import `app` at the top of the file (same pattern as `tests/api.test.js`).
The fail-fast test must run with the repo's own `.env` absent or present — the
empty-string override wins (dotenv does not replace defined vars).

**Verify**: `npm test` → exit 0; count ≥ 22 total tests across suites.

## Test plan

- New: `tests/validation.test.js` — schema-level happy/edge cases (no LLM) +
  HTTP-level 400s asserting `error.code` + `details[].path` + the env exit test.
- Existing suites (`api`, `errors`, `logging`) must pass **unchanged** — that
  is the regression net for "validation parity, no status drift".
- Verification: `npm test` → all green; boot smoke → 200; fail-fast → exit 1.

## Done criteria

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 with ≥ 22 tests; new file green
- [ ] `Select-String -Path src\routes\*.js -Pattern '\.filter\(f =>'` → no matches (manual required-lists gone)
- [ ] `Select-String -Path src\app.js,src\evaluate.js -Pattern 'dotenv/config'` → no matches
- [ ] `grep` equivalent: `Select-String -Path src\*.js,src\services\*.js,src\lib\*.js,src\server.js -Pattern 'process\.env\.'` → no matches in server code (only `src/env.js` reads `process.env`)
- [ ] Fail-fast smoke exits 1 naming `GROQ_API_KEY`, echoing no value
- [ ] Boot smoke returns `HTTP 200`
- [ ] `.env.example` lists `GROQ_API_KEY`, `PORT`, `NODE_ENV`, `LOG_LEVEL`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Committed and pushed (operator standing instruction) or reported green
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003's `badRequest(message, details)` signature differs from the excerpt
  (this plan builds directly on it).
- zod's installed major changed the API used here (`safeParse`, `error.issues`,
  `z.coerce`) — STOP and report the version rather than rewriting schemas.
- Route handlers turn out to read body fields the schemas **strip** (zod drops
  unknown keys by default) — detect via existing tests failing; if a handler
  needs a field not in its schema, add it to that schema with a pass-through
  equivalent and note it in the report.
- The split-persona issue in Step 4 turns out different from described (e.g.
  `generate-review` really does require `ambience_preference` in some client) —
  re-read the routes' required lists; on mismatch, STOP.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- `src/env.js` is the **only** place `process.env` is read; new config keys
  belong in its schema + `.env.example`. Plans 006 adds `CORS_ORIGIN`,
  `TRUST_PROXY`, `RATE_LIMIT_*` there.
- `GROQ_MODEL` is still hardcoded (`llm.service.js:5`) — natural next key
  (deferred on purpose to keep this diff reviewable).
- The 500-char guard in `processChat` is intentionally redundant with
  `chatBodySchema.max(500)` — service-level callers (future scripts) must stay
  protected.
- A reviewer should check: per-endpoint parity (no endpoint stricter/looser
  than before except integer rating + uuid session_id), no response shape
  changes, env failure never prints a value.
