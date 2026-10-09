# Plan 004: Structured logging, request-id child loggers, graceful shutdown (layers 16, 21, 22, 23)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b739eff..HEAD -- src/app.js src/server.js src/services src/middleware src/lib`
> Expected: changes from plans 001–003 only (`app.js` gained exports/middleware,
> `src/middleware/*` + `src/lib/errors.js` created, `chat.service.js` persistence
> changes). Re-anchor by symbol, not line number; changes beyond 001–003 scopes → STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (log format changes only; no response-body changes)
- **Depends on**: plans/003-error-contract.md
- **Category**: tech-debt
- **Planned at**: commit `b739eff`, 2026-10-09

## Why this matters

Server code logs through 12 `console.*` sites: plain-text, unstructured, no
request correlation, and error **stacks are dropped** (`error.message` only in
the catches plan 003 removed — remaining sites still log message-only or no
meta at all). Layers 21/22/23 mandate a structured logger, a request id bound
to per-request logs, and rich meta (path, status, duration, attempt counts).
Layer 16 (graceful shutdown) is also missing: SIGTERM on Railway/Rolling deploy
kills the process mid-write, and there is no `server.close` drain. This plan
adds pino, a `req.log` child logger on the `req.id` plan 003 created, response
logging with status/duration, redaction of credential-shaped fields, and
SIGTERM/SIGINT handling with a bounded drain.

## Current state

- `console.*` inventory (server code; `src/evaluate.js` is a CLI — exempt):

| Site | Code today |
|------|------------|
| `src/app.js:15-18` | request logger middleware: `console.log('[time] METHOD /path')` (no status, no duration) |
| `src/middleware/errorHandler.js` (from 003) | `console.error('[ERROR]', err)` — already full error, plain text |
| `src/server.js` (from 002) | `console.log('NaijaTaste AI listening on port …')` |
| `src/services/chat.service.js` `saveSessions` | `console.error('[chat] Session persist failed:', err.message)` — message only, no stack |
| `src/services/chat.service.js` recommendation catch | `console.error('[chat] Recommendation failed:', err.message)` — message only |
| `src/services/llm.service.js` retry loop | `console.warn('LLM call failed (attempt …). Retrying in …ms...')` — no status/delay meta |
| `src/services/llm.service.js` corrective retry | `console.warn('JSON parse failed. Attempting corrective retry...')` — parse error detail dropped |

- `src/app.js:15-18` (the block to delete — plan 003 left it in place):

```js
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

- `src/middleware/requestId.js` (created by 003) — id + header only, no logger yet:

```js
export const requestId = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
```

- `src/server.js` (created by 002) — plain `app.listen` + `console.log`, no
  signal handling:

```js
import { app } from './app.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NaijaTaste AI listening on port ${PORT}`);
});
```

- Env at this point: `LOG_LEVEL` does not exist anywhere yet (plan 005 adds it
  to `.env.example` and the zod env module — this plan reads
  `process.env.LOG_LEVEL` directly; 005 will switch the one line).
- No `pino` in `package.json` (001 restored the five backend deps only).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install pino` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests | `npm test` | exit 0 |
| Console grep | `Select-String -Path src\app.js,src\server.js,src\routes\*.js,src\services\*.js,src\middleware\*.js,src\lib\*.js -Pattern 'console\.'` | no matches |
| Boot (manual) | plan 001 block with `src/server.js` | JSON log lines on stdout, `HTTP 200` |

## Scope

**In scope** (the only files you should modify):
- `src/lib/logger.js` (create)
- `src/middleware/requestId.js` (extend with child logger + response log)
- `src/middleware/errorHandler.js` (swap console → `req.log`)
- `src/app.js` (delete the console request-logger middleware)
- `src/server.js` (structured startup log + graceful shutdown)
- `src/services/chat.service.js` (2 console sites → logger)
- `src/services/llm.service.js` (2 console sites → logger)
- `package.json`, `package-lock.json` (pino)
- `tests/logging.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/evaluate.js` — CLI report output stays `console.log` (human-readable by
  design; documented exemption below).
- Response bodies of any endpoint (log-only plan).
- `src/routes/**` — plan 003 removed their console sites already; if you find
  one remaining, STOP (drift).
- Log shipping/aggregation (no external sink — stdout JSON is the contract;
  Railway/Docker collect stdout).

## Git workflow

- Branch: `master`; conventional commit, e.g.
  `feat: structured pino logging with request ids and graceful shutdown`.
- Push after green (operator standing instruction); never push on failure.

## Steps

### Step 1: Install pino and create `src/lib/logger.js`

`npm install pino` (exit 0).

```js
import pino from 'pino';

export const logger = pino({
  name: 'naijataste-ai',
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'apiKey',
      'GEMINI_API_KEY',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});
```

Redaction (layer 8/21): even if a future change accidentally logs config or
headers, credential-shaped fields never reach stdout. Do **not** log prompts or
full request bodies anywhere in this plan.

**Verify**: `node -e "import('./src/lib/logger.js').then(m => m.logger.info({probe:true}, 'logger ok'))"`
→ one JSON line containing `"logger ok"` and `"level":30`.

### Step 2: Extend `src/middleware/requestId.js`

After setting `req.id` and the header, add the child logger and a
response-finish log (layers 22 + 21):

```js
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export const requestId = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id });

  const start = Date.now();
  res.on('finish', () => {
    req.log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
      },
      'request completed'
    );
  });

  next();
};
```

(`finish` not `close` — logs after the response is actually sent.)

**Verify**: `npm run lint` → 0.

### Step 3: Swap the remaining console sites for the logger

1. `src/app.js` — delete the entire request-logger block (the
   `app.use((req, _res, next) => { console.log(...) ... })` middleware, lines
   15-18 as of `b739eff`; re-find by content if lines moved). The `requestId`
   middleware's finish log replaces it.
2. `src/middleware/errorHandler.js` — replace `console.error('[ERROR]', err);`
   with:

```js
const log = req.log || logger;   // import { logger } from '../lib/logger.js'
log.error({ err }, 'unhandled error');
```

   (`{ err }` is pino's serialized-error field — stack preserved, layer 23.)

3. `src/services/chat.service.js` — two sites:

```js
// saveSessions write failure:
logger.error({ err }, 'session persist failed');
// recommendation catch:
logger.error({ err }, 'recommendation failed in chat turn');
```

   (module-level `import { logger } from '../lib/logger.js';` — no request
   context available here, top-level logger is correct.)

4. `src/services/llm.service.js` — two sites:

```js
// retry loop:
logger.warn(
  { attempt, retries, delay_ms: Math.round(delay), status: error?.status },
  'llm call failed, retrying'
);
// corrective retry:
logger.warn({ err: parseError }, 'llm json parse failed, corrective retry');
```

   Do **not** log the corrective prompt or the raw LLM output (noise + payload
   data); the parse error message is enough.

**Verify**: `Select-String -Path src\app.js,src\server.js,src\routes\*.js,src\services\*.js,src\middleware\*.js,src\lib\*.js -Pattern 'console\.'`
→ no matches. (If a site you don't recognize appears in `src/routes/**`, STOP
— that is drift; 003 was supposed to have removed them.)

### Step 4: Startup log + graceful shutdown in `src/server.js`

Replace the file with:

```js
import { app } from './app.js';
import { logger } from './lib/logger.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'NaijaTaste AI listening');
});

const shutdown = (signal) => {
  logger.info({ signal }, 'shutdown requested');
  server.close(() => {
    logger.info({ signal }, 'shutdown complete');
    process.exit(0);
  });
  // Bounded drain: force-exit if keep-alive connections hang past 10s
  setTimeout(() => {
    logger.warn({ signal }, 'shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Layer 16: SIGTERM (deploy) and SIGINT (Ctrl+C) stop accepting connections, let
in-flight requests finish, then exit 0; the unref'd 10s timer prevents a hang.

**Verify**: `npm run lint` → 0; `npm test` → all pass.

### Step 5: Logging tests — create `tests/logging.test.js`

Assert observable contracts only (headers/id), not stdout formats:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { requestId } from '../src/middleware/requestId.js';
import { logger } from '../src/lib/logger.js';

describe('logging (layers 21/22/23)', () => {
  it('every response carries X-Request-Id', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('rejects malformed inbound ids, generates its own', async () => {
    const res = await request(app)
      .get('/health')
      .set('X-Request-Id', 'bad id with spaces and <tags>')
      .expect(200);
    expect(res.headers['x-request-id']).not.toContain(' ');
  });

  it('attaches req.log child logger with the same id', async () => {
    let captured = null;
    const mw = (req, _res, next) => { captured = { id: req.id, hasLog: typeof req.log?.info === 'function' }; next(); };
    // compose: requestId then capture, mounted before routes
    const { default: express } = await import('express');
    const probe = express();
    probe.use(requestId);
    probe.use(mw);
    probe.get('/probe', (_req, res) => res.json({ ok: true }));
    await request(probe).get('/probe').set('X-Request-Id', 'probe-id-12345').expect(200);
    expect(captured).toEqual({ id: 'probe-id-12345', hasLog: true });
  });

  it('logger exports a pino instance with info level', () => {
    expect(typeof logger.child).toBe('function');
    expect(logger.level).toBe(process.env.LOG_LEVEL || 'info');
  });
});
```

**Verify**: `npm test` → exit 0, all pass (≥ 4 new tests).

### Step 6: Manual observability check

Boot with the plan-001 smoke block (dummy key) and hit `/health` twice:
stdout must show JSON lines like `{"level":30,"msg":"request completed",
"method":"GET","path":"/health","status":200,"duration_ms":…,"requestId":…}`
and one `"NaijaTaste AI listening"` line. Then stop the server with
`Stop-Process` (Windows) — record that graceful-drain verification is POSIX-only:

- POSIX (if available): start server, `kill -TERM <pid>` → stdout shows
  `"shutdown requested"` then `"shutdown complete"`, process exits 0.

**Verify**: JSON lines observed; on POSIX the two shutdown lines observed; on
Windows record "SIGTERM drain verified by code review only — POSIX signal test
skipped (win32)".

## Test plan

- New: `tests/logging.test.js` (4 tests above) — id always present, malformed
  id rejected/regenerated, `req.log` bound, logger config sanity.
- Existing suites must pass unchanged (`npm test`).
- Verification: `npm test` → all green; console grep → no matches; lint → 0.

## Done criteria

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 (≥ 16 tests total across suites)
- [ ] Console grep in "Commands" returns **no matches** for server files
      (only `src/evaluate.js` may still use console — verify it is the sole survivor:
      `Select-String -Path src\*.js,src\*\*.js -Pattern 'console\.'` → matches only in `evaluate.js`)
- [ ] Boot shows JSON log lines with `requestId`, `status`, `duration_ms`
- [ ] `SIGTERM` handling present in `src/server.js` (`process.on('SIGTERM'` grep → 1 match)
- [ ] `logger.js` contains the redact block (grep `REDACTED` → 1 match)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Committed and pushed (operator standing instruction) or reported green
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003's `req.id`/`requestId` middleware is missing or materially different
  (this plan extends it — if it drifted, STOP).
- A `console.*` site appears in `src/routes/**` (003 was supposed to remove
  them — drift) or in a file not in this plan's in-scope list.
- pino's API differs from the snippets (e.g. major version breaking change) —
  adapt only if identical semantics; otherwise STOP and report the version.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- **Exemption**: `src/evaluate.js` intentionally keeps human-readable
  `console.log` (offline CLI report). If the eval ever runs as a service, fold
  it under this logger.
- Log shipping is stdout-JSON only — if a sink (Datadog etc.) is added later,
  change the pino transport in `lib/logger.js` only; call sites stay stable.
- Plan 005 switches `logger.js`'s `process.env.LOG_LEVEL` line to the zod
  `env.LOG_LEVEL`; expect that one-line diff there.
- Never log prompts, full bodies, or `.env` — the redact list is a seatbelt,
  not permission.
- A reviewer should check: no response body changed (purely additive logging),
  redaction paths cover credential-shaped keys, shutdown timer is `.unref()`'d.
