# Plan 003: Enforce one error contract with correct status codes (layers 19, 20, 26, 27)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b739eff..HEAD -- src/app.js src/routes src/services/chat.service.js tests`
> Expected: changes from plans 001–002 only (`package.json` scripts are out of
> this diff; `tests/api.test.js` created; `src/app.js` got `export` and lost
> `app.listen`). Re-anchor by **symbol** (handler names, route bodies), not line
> number. Changes beyond 001–002's scopes → compare excerpts, on mismatch STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (status codes change: some 200s become 400/404 — see risk note)
- **Depends on**: plans/002-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `b739eff`, 2026-10-09

## Why this matters

Errors currently come back in three incompatible shapes with wrong status codes:
five catch blocks return **500 with `detail: error.message`** (leaks internal
messages — e.g. driver/path errors — straight to clients); services signal
business failures as `{success:false}` bodies that routes map inconsistently
(recommend → 404, review → 200, chat → 200); `DELETE /chat/:id` claims success
for sessions that never existed; the global error handler at
`src/app.js:65-71` is **unreachable** because no route ever calls `next(err)`;
and `session_persisted: true` is asserted before the async file write has
completed (a lie when the disk write fails). Clients cannot branch on HTTP
semantics, and internals can leak. This plan establishes one error shape, one
typed error class, correct statuses end-to-end, a request id on every response,
and an honest persistence flag.

**Risk note (MED)**: three endpoints change status — `/chat` >500-char messages
200→400, `/generate-review` catalogue-miss 200→404, `DELETE /chat/:id` missing
session 200→404. Verified safe for the deployed frontend: `src/NaijaTasteAI.jsx`
never branches on these bodies (it reads only `session_id`/`stage`/`message`/
`recommendations`/`meta` on success, and shows a generic connection message on
thrown fetch errors); `src/components/ReviewModal.jsx:5-63` uses optional
chaining throughout and renders no worse than today.

## Current state

- `src/app.js` (key blocks; file also has `export const app` and no `listen`
  after plan 002):

```js
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});                                              // :15-18 (plan 004 removes this)

app.use((req, res) => {                          // 404 handler — reachable today
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    available_endpoints: [ "GET  /health", ... ],
  });
});                                              // :47-62

app.use((err, _req, res, _next) => {             // UNREACHABLE — routes never next(err)
  console.error(`[ERROR] ${err.message}`);       // message only, stack dropped
  res.status(500).json({ success: false, error: err.message || "Internal server error" });
});                                              // :65-71
```

- All five catch blocks (verified `next(` count in routes = 0), each leaking
  `detail: error.message`:

```js
// src/routes/chat.routes.js:25-32, persona.routes.js:31-38 and :127-134,
// recommend.routes.js:30-37, review.routes.js:41-48 — same pattern:
} catch (error) {
  console.error('[chat] Error:', error.message);
  return res.status(500).json({
    success: false,
    error: 'Chat processing failed',
    detail: error.message
  });
}
```

- Status mismatches for `{success:false}` service results:

```js
// src/routes/chat.routes.js:21-23 — >500-char guard returns success:false → 200
const result = await processChat(sessionId, message.trim());
return res.status(200).json(result);

// src/routes/review.routes.js:38-39 — unknown restaurant id → 200
const result = await generateReview(persona, restaurant);
return res.status(200).json(result);

// src/routes/recommend.routes.js:27-28 — zero match → 404 (this one is right)
const result = await getRecommendations(persona);
return res.status(result.success === false ? 404 : 200).json(result);

// src/routes/chat.routes.js:48-51 — deleting a nonexistent session → 200 success
router.delete('/chat/:sessionId', (req, res) => {
  const result = clearSession(req.params.sessionId);
  return res.status(200).json(result);
});
```

- Service-side failure objects (the bodies routes must map):

```js
// src/services/chat.service.js:76-82 — returns success:false BEFORE any LLM call
if (userMessage.length > 500) {
  return { success: false, error: 'Message too long. Please keep under 500 characters.', session_id: sessionId };
}

// src/services/review.service.js:73-78
return { success: false, error: `Restaurant with id ${restaurant.restaurant_id} not found in catalogue` };

// src/services/recommend.service.js:94-101
return { success: false, error: 'No restaurants match persona constraints', debug: {...}, persona_id };
```

- Persistence honesty problem — `src/services/chat.service.js`:

```js
const saveSessions = (sessions) => {            // :38 — fire-and-forget, result discarded
  writeQueue = writeQueue.then(() => new Promise((resolve) => {
    writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8', (err) => {
      if (err) console.error('[chat] Session persist failed:', err.message);
      resolve();
    });
  }));
};
...
saveSessions(sessionStore);                    // :166 — not awaited
return { ... meta: { ..., session_persisted: true, ... } };   // :179 — asserted unconditionally
```

- `clearSession` (`:188-192`) returns `{success:true}` unconditionally.
- Health/404 endpoint inventories are duplicated and disagree:
  `src/app.js:27-35` omits `GET /health`; `:51-60` includes it.
- Frontend contract (do not break — this plan changes **nothing** it reads):
  `src/NaijaTasteAI.jsx:112-126` reads `session_id`, `stage`,
  `extracted_persona`, `recommendations.recommendations`, `meta`, `message`;
  error bodies are ignored entirely (generic message on thrown errors only).
- Repo convention to match: success bodies keep `success: true` + data at top
  level (e.g. `src/routes/chat.routes.js:44`); `tests/api.test.js` asserts
  status + `success === false` only (must keep passing).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 (4 existing + new pass) |
| Lint | `npm run lint` | exit 0 |
| Leak grep | `Select-String -Path src\routes\*.js -Pattern 'detail: error.message'` | no matches |
| next() grep | `(Select-String -Path src\routes\*.js -Pattern 'next\(').Count` | > 0 |
| Boot smoke | plan 001 block (with `src/server.js`) | `HTTP 200` |

## Scope

**In scope** (the only files you should modify):
- `src/lib/errors.js` (create), `src/middleware/requestId.js` (create),
  `src/middleware/errorHandler.js` (create)
- `src/app.js` (mount middleware, dedupe endpoint list, 404 shape, swap handler)
- `src/routes/chat.routes.js`, `src/routes/review.routes.js`,
  `src/routes/recommend.routes.js`, `src/routes/persona.routes.js`
- `src/services/chat.service.js` (persistence honesty only)
- `tests/errors.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- Any `.jsx` file — if a frontend change looks necessary, STOP (see STOP conditions).
- `src/services/review.service.js`, `recommend.service.js`, `persona.service.js`,
  `llm.service.js` — failure objects they return stay as-is; routes map them.
- The recommendation-failure latch (`chat.service.js:137/158`) — a known
  correctness finding deferred to the next round (see `plans/README.md`);
  this plan only touches the `saveSessions`/`clearSession`/meta area.
- Success-body field names (frontend reads them).

## Git workflow

- Branch: `master`; conventional commit, e.g.
  `fix: unify error contract with correct status codes`.
- Push after green (operator standing instruction); never push on failure.

## Steps

### Step 1: Typed errors — create `src/lib/errors.js`

```js
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;   // optional: array of { path?, message }
  }
}

export const badRequest = (message, details) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);

export const notFound = (code, message) =>
  new ApiError(404, code, message);

export const isApiError = (err) => err instanceof ApiError;
```

Code vocabulary (layer 19 — fixed set, used everywhere):
`VALIDATION_ERROR` (400), `SESSION_NOT_FOUND` / `ROUTE_NOT_FOUND` /
`RESTAURANT_NOT_FOUND` / `NO_MATCHES` (404), `UPSTREAM_FAILURE` (502),
`INTERNAL` (500).

**Verify**: `node -e "import('./src/lib/errors.js').then(m => console.log(m.badRequest('x').code))"` → `VALIDATION_ERROR`.

### Step 2: Request id middleware — create `src/middleware/requestId.js`

```js
import { randomUUID } from 'crypto';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export const requestId = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
```

(Inbound ids are honored so a client/proxy correlation id survives — layer 22.
Validation prevents header injection into logs.)

**Verify**: after mounting (Step 3), `npm test` includes an id-echo test below.

### Step 3: Central error handler — create `src/middleware/errorHandler.js`

```js
import { ApiError } from '../lib/errors.js';

export const errorHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (typeof err?.status === 'number') {
    // Groq SDK errors carry .status — anything unexpected from the LLM
    // upstream is a 502, never a leak of the SDK message (layers 19/26).
    status = 502;
    code = 'UPSTREAM_FAILURE';
    message = 'Upstream LLM request failed';
  }

  if (status >= 500) {
    console.error('[ERROR]', err);   // full error incl. stack; plan 004 → req.log
  }

  res.status(status).json({
    success: false,
    error: { code, message },
    ...(details ? { details } : {}),
    ...(req.id ? { requestId: req.id } : {}),
  });
};
```

The 4th `_next` parameter is **required** — Express identifies error middleware
by arity. Never drop it.

**Verify**: file exists; `npm run lint` still exit 0.

### Step 4: Rewire `src/app.js`

1. Add imports: `import { requestId } from './middleware/requestId.js';` and
   `import { errorHandler } from './middleware/errorHandler.js';`.
2. Mount `app.use(requestId);` immediately after the `express.json` line
   (before `cors`), so every response — including 404s and errors — carries the id.
3. Dedupe the endpoint inventories: add one module-level const and use it in
   both the health endpoint and the 404 handler:

```js
const ENDPOINTS = [
  'GET  /health',
  'POST /extract-persona',
  'POST /update-preference',
  'POST /recommend',
  'POST /generate-review',
  'POST /chat',
  'GET  /chat/:sessionId',
  'DELETE /chat/:sessionId',
];
```

Health keeps its current body fields (`status`, `service`, `version`,
`timestamp`, `endpoints: ENDPOINTS`).

4. Replace the 404 handler body's error value with the contract shape (keep
   `available_endpoints: ENDPOINTS` as an additive extra):

```js
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    available_endpoints: ENDPOINTS,
    requestId: req.id,
  });
});
```

5. Replace the old global handler (`console.error('[ERROR]', err.message)` …)
   with `app.use(errorHandler);`.

**Verify**: `npm test` → still all green (baseline asserts only `success:false`
+ statuses, all preserved so far).

### Step 5: Convert the four route files to `next(err)` + mapped statuses

Common conversion for **every** `catch` in all four route files
(`chat`, `review`, `recommend`, `persona` — 5 sites):

```js
} catch (err) {
  next(err);
}
```

(handlers become/remain `async (req, res, next) => { … }`; delete the
`console.error` + inline 500 json). Route by route:

**`src/routes/chat.routes.js`**
- Import `{ badRequest, notFound }` from `../lib/errors.js`.
- Missing-message check → `return next(badRequest('message is required'));`
  (keep the exact condition).
- After `processChat`:

```js
const result = await processChat(sessionId, message.trim());
if (!result.success) {
  // processChat returns success:false only for the >500-char guard
  return next(badRequest(result.error));
}
return res.status(200).json(result);
```

- GET session miss → `return next(notFound('SESSION_NOT_FOUND', 'Session not found'));`
- DELETE — make async, single source of truth is the service:

```js
router.delete('/chat/:sessionId', async (req, res, next) => {
  try {
    const result = await clearSession(req.params.sessionId);
    if (!result.success) return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
```

**`src/routes/review.routes.js`**
- Both missing-field checks → `next(badRequest(<same message>))`.
- After `generateReview`:

```js
const result = await generateReview(persona, restaurant);
if (result.success === false) return next(notFound('RESTAURANT_NOT_FOUND', result.error));
return res.status(200).json(result);
```

**`src/routes/recommend.routes.js`**
- Missing persona / missing fields → `next(badRequest(<same message>))`.
- After `getRecommendations`:

```js
const result = await getRecommendations(persona);
if (result.success === false) return next(notFound('NO_MATCHES', result.error));
return res.status(200).json(result);
```

**`src/routes/persona.routes.js`**
- `raw_text` check → `next(badRequest('raw_text is required and must be at least 10 characters'))`.
- `persona`/`signal` presence → `next(badRequest(<same message>))`.
- Missing signal fields → preserve the field documentation as `details`
  (layer 19 detail pattern; this replaces the old top-level
  `expected_signal_shape` key):

```js
return next(badRequest(`Missing signal fields: ${missing.join(', ')}`, [
  { path: 'signal.dimension', message: 'ambience | budget | spice | cuisine | social_context' },
  { path: 'signal.value', message: 'the specific value e.g. buka, premium, hot' },
  { path: 'signal.rating', message: 'integer 1-5 from user feedback' },
]));
```

- Rating-range check → `next(badRequest('signal.rating must be between 1 and 5'))`.

**Verify**: `npm run lint` → 0; `(Select-String -Path src\routes\*.js -Pattern 'next\(').Count`
→ ≥ 10; `Select-String -Path src\routes\*.js -Pattern 'detail: error.message'` → no matches;
`npm test` → all pass.

### Step 6: Persistence honesty in `src/services/chat.service.js`

1. Make `saveSessions` return the queued promise and resolve a boolean:

```js
const saveSessions = (sessions) => {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve) => {
        writeFile(
          SESSIONS_FILE,
          JSON.stringify(sessions, null, 2),
          'utf-8',
          (err) => {
            if (err) {
              console.error('[chat] Session persist failed:', err.message);
              resolve(false);
            } else {
              resolve(true);
            }
          }
        );
      })
  );
  return writeQueue;
};
```

2. In `processChat`, await it and use the real result:

```js
sessionStore[sessionId] = session;
const persisted = await saveSessions(sessionStore);

return {
  success: true,
  ...
  meta: {
    ...
    session_persisted: persisted,
    ...
  }
};
```

3. Make `clearSession` async and honest:

```js
export const clearSession = async (sessionId) => {
  if (!sessionStore[sessionId]) {
    return { success: false, session_id: sessionId };
  }
  delete sessionStore[sessionId];
  const persisted = await saveSessions(sessionStore);
  return { success: true, session_id: sessionId, persisted };
};
```

(Awaiting adds single-digit ms; the queue already serializes writes.)
(`console.error` here stays until plan 004 swaps it for the logger.)

**Verify**: `npm test` → all pass.

### Step 7: Contract tests — create `tests/errors.test.js`

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { ApiError, badRequest, notFound } from '../src/lib/errors.js';

describe('error contract (layers 19/20/26/27)', () => {
  it('validation failure carries error.code and requestId', async () => {
    const res = await request(app).post('/chat').send({}).expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'message is required' });
    expect(res.body.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('honors an inbound X-Request-Id and returns it in the header', async () => {
    const res = await request(app)
      .get('/health')
      .set('X-Request-Id', 'client-abc-12345678')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('client-abc-12345678');
  });

  it('rejects over-long chat messages with 400 (was 200)', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'x'.repeat(501) })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE of a missing session returns 404 SESSION_NOT_FOUND (was 200)', async () => {
    const res = await request(app)
      .delete('/chat/11111111-1111-4111-8111-111111111111')
      .expect(404);
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('unknown route returns 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.available_endpoints).toContain('GET  /health');
  });

  it('review with missing body returns 400 without calling the LLM', async () => {
    const res = await request(app).post('/generate-review').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recommend with missing persona returns 400 without calling the LLM', async () => {
    const res = await request(app).post('/recommend').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps ApiError and upstream errors correctly (unit)', () => {
    const makeRes = () => ({
      statusCode: 0,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
    });
    const noop = () => {};

    const r1 = makeRes();
    errorHandler(badRequest('bad field'), { id: 'x' }, r1, noop);
    expect(r1.statusCode).toBe(400);
    expect(r1.body.error.code).toBe('VALIDATION_ERROR');

    const r2 = makeRes();
    errorHandler(notFound('NO_MATCHES', 'nope'), { id: 'x' }, r2, noop);
    expect(r2.statusCode).toBe(404);
    expect(r2.body.error.code).toBe('NO_MATCHES');

    const r3 = makeRes();
    errorHandler(Object.assign(new Error('boom'), { status: 503 }), { id: 'x' }, r3, noop);
    expect(r3.statusCode).toBe(502);
    expect(r3.body.error.code).toBe('UPSTREAM_FAILURE');
    expect(r3.body.error.message).not.toBe('boom');   // no upstream leak

    const r4 = makeRes();
    errorHandler(new Error('boom'), { id: 'x' }, r4, noop);
    expect(r4.statusCode).toBe(500);
    expect(r4.body.error.code).toBe('INTERNAL');
    expect(r4.body.error.message).toBe('Internal server error');   // no message leak
  });
});
```

with the import line at the top of the file extended to
`import { errorHandler } from '../src/middleware/errorHandler.js';`.

**Verify**: `npm test` → exit 0; count ≥ 12 tests total (4 baseline + ≥8 new).

## Test plan

- New: `tests/errors.test.js` — cases listed above (happy path for the contract
  itself, every changed status code, id echo, leak-free 500).
- Existing `tests/api.test.js` must pass **unchanged** (its status assertions
  are contract-stable — that was plan 002's design).
- No LLM calls anywhere: every new test hits validation/404/DELETE paths only.
- Verification: `npm test` → all pass; `npm run lint` → 0.

## Done criteria

- [ ] `npm test` exits 0 with ≥ 12 tests; baseline 4 unchanged and passing
- [ ] `npm run lint` exits 0
- [ ] `Select-String -Path src\routes\*.js -Pattern 'detail: error.message'` → no matches
- [ ] `Select-String -Path src -Pattern "err\.message \|\| " ` → no matches (old handler gone)
- [ ] `(Select-String -Path src\routes\*.js -Pattern 'next\(').Count` ≥ 10
- [ ] Every response body for errors matches
      `{ success:false, error:{ code, message }, [details], [requestId] }`
- [ ] `session_persisted` in a chat response equals the actual write result
      (code review: comes from `await saveSessions`, not literal `true`)
- [ ] Boot smoke returns `HTTP 200`; a manual `POST /chat` with empty body
      returns 400 + `requestId`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Committed and pushed (operator standing instruction) or reported green
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `Select-String -Path src\*.jsx,src\components\*.jsx -Pattern '\.error\b|\bsuccess\b'`
  reveals a frontend consumer of the error **string** shape (the audit found
  none — `NaijaTasteAI.jsx` reads only success fields; `ReviewModal.jsx` only
  optional-chains review fields). If you find one, STOP: changing that file is
  out of scope and the shape decision needs the operator.
- The code at the locations in "Current state" doesn't match the excerpts
  beyond plans 001–002's known changes (drift).
- `processChat` starts returning `success:false` for reasons other than the
  >500-char guard (that would make `badRequest` the wrong mapping).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- The error code set is a contract: new failure modes must reuse
  `VALIDATION_ERROR`/404 codes/`UPSTREAM_FAILURE`/`INTERNAL` or consciously
  extend it in `src/lib/errors.js` (and add a test).
- Plan 004 replaces `console.error('[ERROR]', err)` in the handler with
  `req.log.error({ err }, …)` — expect that one-line change there.
- Plan 005 replaces the manual validation checks with zod middleware **through
  these same `badRequest` helpers**; keep messages identical where possible so
  its diffs stay small.
- A reviewer should scrutinize: the three status-code changes (200→400/404) and
  that no `error.message` from a non-`ApiError` ever reaches a client (the 500
  path must say `'Internal server error'`).
- Deferred (next round): recommendation failure latch — do not "fix" it while
  in this file, it changes recommendation semantics and needs its own plan.
