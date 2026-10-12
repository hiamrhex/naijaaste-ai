# Plan 011: Fail closed on CORS in production when the allowlist is empty

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/app.js src/env.js .env.example tests/limits.test.js`
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

With `CORS_ORIGIN` unset the server reflects any origin while allowing credentials. A warning is logged but serving continues — so one missing env var on a production deploy lets any website make credentialed calls (refresh cookie, bearer) as your users and read the responses. After this plan, production refuses to boot without an allowlist; dev/test keep today's convenient reflect behavior.

## Current state

- `src/app.js:30-49` (verified at 80e106e): builds `allowedOrigins` from `env.CORS_ORIGIN`; empty → `logger.warn("CORS_ORIGIN not set — allowing requests from any origin")` and `cors({ origin: true, credentials: true, ... })`.
- `src/env.js:8,19`: `NODE_ENV` enum defaults `development`; `CORS_ORIGIN` optional string. Fail-fast precedent: missing required keys print field names only and `process.exit(1)` (`src/env.js:29-36`).
- Tests pinning current behavior: `tests/limits.test.js:49-64` sets `CORS_ORIGIN=https://allowed.example` via dynamic import and asserts reflect/deny. Those must keep passing.
- Repo conventions: zod env schema; `fail()`/`ok()` responders; supertest; `npm test`, `npm run lint`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Env gate test | `npx vitest run tests/env-guard.test.js` (new) | all pass |
| CORS behavior | `npx vitest run tests/limits.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/env.js` (production CORS requirement)
- `src/app.js` (only if the warn text needs a dev-only qualifier — prefer no change)
- `.env.example` (document the production requirement)
- `tests/env-guard.test.js` (new)

**Out of scope**:
- CORS options, exposed headers, credentials flag.
- Any route, limiter, or error-shape change.

## Git workflow

- Branch: `advisor/011-cors-fail-closed`
- Commit message style: conventional — e.g. `fix: require CORS_ORIGIN in production`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Require `CORS_ORIGIN` when `NODE_ENV=production`

In `src/env.js`, after `safeParse`, add a production guard before exporting:
```js
if (parsed.success && parsed.data.NODE_ENV === 'production' && !parsed.data.CORS_ORIGIN) {
  console.error('Invalid environment configuration:');
  console.error('  - CORS_ORIGIN: required in production (comma-separated allowed origins)');
  process.exit(1);
}
```
Match the existing field-name-only style (never print values). Dev/test behavior unchanged.

**Verify**: `CORS_ORIGIN= NODE_ENV=production node -e "import('./src/env.js')"` → exit 1 mentioning CORS_ORIGIN (needs other required keys present — use the real `.env` if it has them, else expect the missing-key errors instead; the assertion that matters is covered in step 2).

### Step 2: Add a spawn-based env-guard test

Create `tests/env-guard.test.js` following the `tests/validation.test.js` fail-fast spawn pattern (`execFileSync(process.execPath, [...], { env: {...} })` asserting exit code + stderr text):
1. `NODE_ENV=production`, no `CORS_ORIGIN`, all other required keys present (reuse the vitest config values: `GEMINI_API_KEY=test-key-not-real`, both JWT secrets) → child `node -e "import('./src/env.js')"` exits 1, stderr names `CORS_ORIGIN`, stderr contains no secret values.
2. `NODE_ENV=development`, no `CORS_ORIGIN` → exit 0 (dev convenience preserved).

**Verify**: `npx vitest run tests/env-guard.test.js` → all pass.

### Step 3: Document the requirement

`.env.example`: change the CORS comment to:
```
# CORS_ORIGIN=https://your-frontend.example.com (comma-separated for several)
# REQUIRED in production (server refuses to boot without it); optional in dev.
```

**Verify**: `grep -n "REQUIRED in production" .env.example` → match; `npm run lint` → exit 0.

## Test plan

- New `tests/env-guard.test.js` (prod-without-allowlist exits 1 naming the field; dev-without exits 0), modeled on the fail-fast spawn test in `tests/validation.test.js`.
- Existing `tests/limits.test.js` CORS block must pass unmodified (it sets the var).
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0 (including new `tests/env-guard.test.js`)
- [ ] `npm run lint` exits 0
- [ ] `grep -n "CORS_ORIGIN" src/env.js` → match in the production guard
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The spawn test can't isolate env (parent `.env` leaking via dotenv) — dotenv does not override existing vars, so set every key explicitly in the child env; if still leaking, report instead of weakening the test.
- Fixing requires touching CORS options or any route.

## Maintenance notes

- Deployments must set `CORS_ORIGIN` before flipping `NODE_ENV=production` — note this in the deploy docs when they're next touched.
- Reviewer: confirm the guard prints no values (values-adjacent regression risk).
- Deferred: per-origin method/header tightening (out of scope).
