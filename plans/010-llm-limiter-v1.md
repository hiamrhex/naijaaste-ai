# Plan 010: Enforce the LLM rate limiter on the canonical /api/v1 mounts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/app.js tests/limits.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `80e106e`, 2026-10-12

## Why this matters

The LLM limiter (`RATE_LIMIT_LLM_MAX`, default 10/min) is the only guard on paid Gemini quota, but it binds solely to legacy unprefixed paths. Every canonical `/api/v1/chat`, `/api/v1/recommend`, `/api/v1/agent` call — the paths the health probe advertises and new clients use — gets only the coarse 600/15-min API limiter. A scraper on canonical paths can burn the Gemini budget ~60× faster than intended. After this plan both mounts share the LLM guard.

## Current state

- `src/app.js:105-117` (verified at 80e106e):
```js
const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_LLM_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limiterHandler(60),
});

app.use(apiLimiter);
app.use(
  ["/chat", "/extract-persona", "/update-preference", "/recommend", "/generate-review", "/agent"],
  llmLimiter
);
```
- `src/app.js:135-146`: every router is mounted at both `/api/v1` and `/` — so the same handlers are reachable both ways, but only `/`-prefixed hits match the limiter paths above.
- `limiterHandler` (unified 429 shape + `Retry-After`) must be reused unchanged.
- Test pattern to copy: `tests/limits.test.js:12-17` sets `process.env.RATE_LIMIT_API_MAX='3'` etc. in `beforeAll`, then `await import('../src/app.js')` (per-file isolation), asserting 429 + `error.requestId` + `retry-after` + draft-7 `ratelimit` header.
- Repo conventions: supertest vs `../src/app.js`; `npm test`, `npm run lint`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/limits.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/app.js` (limiter mount paths only)
- `tests/limits.test.js` (new canonical-path test)

**Out of scope**:
- Limiter windows, limits, env keys, 429 shape, `Retry-After` logic.
- Any route handler or validation change.
- `/health` exemption (stays exactly as-is).

## Git workflow

- Branch: `advisor/010-llm-limiter-v1`
- Commit message style: conventional — e.g. `fix: enforce LLM rate limiter on /api/v1 mounts`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Mount the LLM limiter on versioned prefixes too

In `src/app.js`, extend the mount-path array so both prefixes are guarded:
```js
app.use(
  ["/chat", "/extract-persona", "/update-preference", "/recommend", "/generate-review", "/agent",
   "/api/v1/chat", "/api/v1/extract-persona", "/api/v1/update-preference", "/api/v1/recommend", "/api/v1/generate-review", "/api/v1/agent"],
  llmLimiter
);
```
Do not change windows, limits, handler, or the `/health` skip.

**Verify**: `grep -n "api/v1/chat" src/app.js` → match inside the limiter mount.

### Step 2: Add a canonical-path throttle test

In `tests/limits.test.js`, add a test in the existing `beforeAll` env (`RATE_LIMIT_LLM_MAX='10'` is too high to trip cheaply — instead assert with the API limiter already covered, so write the new test to trip the LLM limiter on a cheap path): set `process.env.RATE_LIMIT_LLM_MAX` cannot be changed per-test (single import). The existing file imports once with LLM_MAX=10. POST `/api/v1/chat` with `{}` 11 times → the 11th must be 429 with `error.code==='RATE_LIMITED'`, `error.requestId` matching `/^[A-Za-z0-9-]{8,64}$/`, and `retry-after` header present. (400 validation responses still count toward the limiter — the limiter runs before routes.) Also assert the legacy path still throttles (already covered — do not duplicate).

**Verify**: `npx vitest run tests/limits.test.js` → all pass including the new test.

## Test plan

- 1 new test in `tests/limits.test.js` (canonical LLM path trips 429 with shape + headers), modeled on the existing 429 test in that file.
- Full suite must pass unmodified otherwise.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `grep -n "api/v1/agent" src/app.js` → match in the limiter mount block
- [ ] New canonical-429 test exists in `tests/limits.test.js` and passes
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 010 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The 11-request test is flaky or trips the API limiter first (counts interact) — report counts instead of raising limits.
- Fixing requires touching limiter config, handler shape, or routes.

## Maintenance notes

- If a third mount prefix is ever added, it must be added to this array too — reviewers should check the limiter array on any mount change.
- Deferred: per-user LLM budgets (this plan keeps the current per-IP limiter).
