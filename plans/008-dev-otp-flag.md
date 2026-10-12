# Plan 008: Gate dev_otp on an explicit flag so misconfigured deploys can't leak reset codes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/services/email.service.js src/routes/auth.routes.js src/env.js vitest.config.js .env.example tests/reset-nearby.test.js`
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

`POST /auth/forgot-password` returns the live 6-digit reset code as `dev_otp` whenever SMTP is unconfigured **or delivery fails** outside production. On any non-production deploy without SMTP (staging, demo, misconfigured prod-like env), anyone who knows an email address gets that account's reset code in the response body — full account takeover with no inbox access. After this plan, `dev_otp` exists only when an operator explicitly opts in AND the app is not in production.

## Current state

- `src/services/email.service.js:55-79` (verified at 80e106e):
```js
export const sendOtpEmail = async ({ to, name, code }) => {
  const isProd = env.NODE_ENV === 'production';
  if (!smtpConfigured()) {
    if (isProd) {
      logger.warn('smtp not configured — otp email skipped in production');
      return { delivered: false };
    }
    logger.warn({ to, otp: code }, 'smtp not configured — dev otp fallback');
    return { delivered: false, dev_otp: code };
  }
  try {
    await getTransporter().sendMail({ ... });
    return { delivered: true };
  } catch (err) {
    logger.error({ err }, 'smtp delivery failed');
    if (isProd) return { delivered: false };
    return { delivered: false, dev_otp: code };
  }
};
```
- `src/routes/auth.routes.js:206-211` spreads `delivery.dev_otp` into the JSON response when present.
- `src/env.js:4-25` has no dev-OTP flag. `NODE_ENV` defaults to `development` (`src/env.js:8`).
- Tests depend on `dev_otp`: `tests/reset-nearby.test.js:44-51` expects `res.body.dev_otp` to match `/^\d{6}$/` and stores it in `globalThis.__resetOtp`. Test env is fixed in `vitest.config.js:5-14` (`NODE_ENV: 'test'`).
- Repo conventions: zod env schema in `src/env.js` (fail-fast, field names only); responses use `fail()`/`ok()` from `src/lib/respond.js`; tests use supertest against `../src/app.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/reset-nearby.test.js tests/auth.test.js` | all pass |
| Full suite | `npm test` | all pass (13 files) |
| Lint | `npm run lint` | exit 0, no errors |

## Scope

**In scope**:
- `src/env.js` (add flag)
- `src/services/email.service.js` (gate `dev_otp`)
- `vitest.config.js` (enable flag for tests)
- `.env.example` (document flag)
- `tests/reset-nearby.test.js` (assert flag-off behavior)

**Out of scope**:
- The `logger.warn({ to, otp: code })` line — plan 009 owns all log-secret removal; do not touch it here.
- SMTP transport, retry, or templating changes.
- `NODE_ENV=production` behavior other than "never return dev_otp" (already correct).

## Git workflow

- Branch: `advisor/008-dev-otp-flag` (repo uses direct master commits, but plan work goes on a branch for review)
- Commit message style: conventional (`fix:`, `feat:`) — e.g. `fix: gate dev_otp on explicit DEV_OTP_ENABLED flag`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Add `DEV_OTP_ENABLED` to the env schema

In `src/env.js`, add after `ADMIN_EMAILS`:
```js
DEV_OTP_ENABLED: z.enum(['true', 'false']).default('false'),
```
Expose a boolean-ish read: keep the raw string in `env` (repo convention: env values are strings/numbers; compare with `=== 'true'` at use sites).

**Verify**: `node -e "import('./src/env.js').then(m => console.log(m.env.DEV_OTP_ENABLED))"` → `false` (with no such var in shell/`.env`).

### Step 2: Gate `dev_otp` in `sendOtpEmail`

Replace both `return { delivered: false, dev_otp: code };` lines with logic that returns `dev_otp` only when `env.DEV_OTP_ENABLED === 'true' && env.NODE_ENV !== 'production'`; otherwise return `{ delivered: false }`. Keep the production early-returns exactly as they are. Keep the response-neutral behavior: the route already returns the generic message either way — do not change the route.

**Verify**: `npx vitest run tests/reset-nearby.test.js` → FAILS at the `dev_otp` assertion (proves the gate works; fixed in step 3). Failure must be only the missing-`dev_otp` assertions, nothing else.

### Step 3: Enable the flag for the test env + assert flag-off behavior

- `vitest.config.js` test env: add `DEV_OTP_ENABLED: 'true'`.
- `tests/reset-nearby.test.js`: add a test that with the flag off there is no `dev_otp`. Since vitest env is file-wide, implement it by spawning: reuse the existing fail-fast spawn pattern from `tests/validation.test.js` (child `node -e` that imports the built route? simpler: unit-test `sendOtpEmail` directly with a dynamic import after temporarily deleting the env var — but `src/env.js` parses at import time, so instead assert at the route level via `await import('../src/app.js')` in a file where `process.env.DEV_OTP_ENABLED='false'` is set in `beforeAll` like `tests/limits.test.js` does for rate keys). Concretely: in `tests/reset-nearby.test.js`, the existing test at line ~44 runs with flag on (vitest config). Add a new `describe` block in the same file? No — env is per-file. Instead: extend the existing `expect(res.body).not.toHaveProperty('dev_otp')` test (line 41, unknown-email case) — that already covers absence. Add one more assertion to the known-account test file `tests/auth.test.js`? Simplest sufficient coverage: keep line-41 test, and add to `tests/reset-nearby.test.js` a test posting forgot-password for a known account with a *malformed* email? No.
  Decision: add the flag-off test to `tests/auth.test.js` is wrong env too. Correct approach: create `tests/dev-otp-flag.test.js` that sets `process.env.DEV_OTP_ENABLED = 'false'` in `beforeAll`, dynamic-imports the app, signs up a user, posts forgot-password, and asserts `not.toHaveProperty('dev_otp')`. This mirrors the `tests/limits.test.js:12-17` dynamic-import pattern exactly.

**Verify**: `npx vitest run tests/dev-otp-flag.test.js tests/reset-nearby.test.js` → all pass (flag-off absence + flag-on presence both proven).

### Step 4: Document the flag

`.env.example`: add commented lines:
```
# Dev OTP fallback: ONLY for local development. Returns the reset code as
# dev_otp in the forgot-password response. NEVER enable in production or
# any shared deploy — anyone with an email could take over accounts.
# DEV_OTP_ENABLED=false
```

**Verify**: `grep -n DEV_OTP .env.example` → shows the block; `npm run lint` → exit 0.

## Test plan

- New file `tests/dev-otp-flag.test.js` (flag off → no `dev_otp`, still generic 200 message; follows `tests/limits.test.js` dynamic-import pattern).
- Existing `tests/reset-nearby.test.js:44-51` (flag on via vitest config → `dev_otp` present) must keep passing unmodified.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0 (all files, including new `tests/dev-otp-flag.test.js`)
- [ ] `npm run lint` exits 0
- [ ] `grep -rn "dev_otp: code" src/services/email.service.js` returns no matches (both returns gated)
- [ ] `grep -n DEV_OTP_ENABLED vitest.config.js .env.example src/env.js` returns matches in all three
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `tests/reset-nearby.test.js` fails on anything other than the `dev_otp` assertion after step 2.
- `src/env.js` has changed shape (e.g. someone already added a similarly-named flag) — reconcile names instead of duplicating.
- Fixing requires touching SMTP transport or route response shapes.

## Maintenance notes

- If a staging environment needs the fallback, set `DEV_OTP_ENABLED=true` there explicitly — never default it on.
- Reviewer: confirm no log line prints the code (that's plan 009's territory, but don't introduce new ones here).
- Deferred: alerting on unconfigured SMTP in production (the `logger.warn` at email.service.js:60 stays as-is).
