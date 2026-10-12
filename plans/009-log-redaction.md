# Plan 009: Remove OTP and PII from logs and extend pino redaction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/services/email.service.js src/lib/logger.js tests/logging.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (touches the same log line plan 008 deliberately left alone; run in any order, do not edit it in the same commit)
- **Category**: security
- **Planned at**: commit `80e106e`, 2026-10-12

## Why this matters

Today a password-reset request writes the recipient's email AND the live plaintext OTP into the logs. Every log reader, retention bucket, and shipped log file becomes a credential store: anyone with log access can redeem reset codes. After this plan, delivery outcomes are logged with correlation only, and the pino redact list covers all auth-secret shapes so future log calls can't reintroduce the leak silently.

## Current state

- `src/services/email.service.js:63` (verified at 80e106e):
```js
logger.warn({ to, otp: code }, 'smtp not configured — dev otp fallback');
```
- `src/lib/logger.js:7-16` (verified at 80e106e): redact paths are only `apiKey`, `GEMINI_API_KEY`, `*.apiKey`, `req.headers.authorization`, `req.headers.cookie`, censor `[REDACTED]`.
- `src/services/email.service.js:76`: `logger.error({ err }, 'smtp delivery failed')` — nodemailer errors can carry SMTP auth details; redaction must cover it.
- Existing log tests live in `tests/logging.test.js` (request-id/status assertions — do not break them).
- Repo conventions: pino via `src/lib/logger.js`, per-request child `req.log`; tests use vitest; lint with `npm run lint`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/logging.test.js tests/reset-nearby.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/services/email.service.js` (log line only — no delivery logic changes)
- `src/lib/logger.js` (redact list only)
- `tests/logging.test.js` (new assertions)

**Out of scope**:
- `dev_otp` response gating (plan 008 — do not touch the return values).
- SMTP transport, templates, retry.
- Any other route's log calls.

## Git workflow

- Branch: `advisor/009-log-redaction`
- Commit message style: conventional — e.g. `fix: stop logging OTP and extend pino redaction`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Strip secrets from the email-service log line

Change `src/services/email.service.js:63` to log outcome + correlation only, e.g.:
```js
logger.warn('smtp not configured — dev otp fallback (code withheld from logs)');
```
No `to`, no `code`, no email. Keep the production warn at line 60 as-is (it already carries no secrets).

**Verify**: `grep -n "otp: code\|{ to" src/services/email.service.js` → no matches.

### Step 2: Extend the redact list

In `src/lib/logger.js`, add paths (keep existing ones): `otp`, `*.otp`, `dev_otp`, `*.dev_otp`, `password`, `*.password`, `credential`, `*.credential`, `accessToken`, `*.accessToken`, `refreshToken`, `*.refreshToken`, `req.body.password`, `req.body.credential`, `req.body.new_password`, `*.new_password`, `SMTP_PASS`, `*.pass` is too broad — do NOT add bare `pass`. Keep the censor `[REDACTED]`.

**Verify**: `node -e "import('./src/lib/logger.js').then(m => { const l = m.logger.child({}); l.info({ otp: '123456', dev_otp: '654321', password: 'x', credential: 'y', accessToken: 'z' }, 'redact check'); })"` → output contains `[REDACTED]` and none of the values. (Pino redaction applies at write time; confirm visually.)

### Step 3: Add regression tests

In `tests/logging.test.js`, add:
1. A test importing the logger with an in-memory destination (pino `destination` stream or `pino({ }, stream)`? The exported singleton writes to stdout — instead assert on configuration: import `src/lib/logger.js` is a singleton; simpler and robust: spy on `logger.warn`/`logger.error` via `vi.spyOn` from `vitest`, call `sendOtpEmail` with SMTP unconfigured, assert the first arg has no `to`/`otp`/`code` keys. `sendOtpEmail` reads env at import; SMTP unset in test env already (vitest config has no SMTP_*), so the fallback path triggers.
2. A redact-config test: read the redact paths without importing side effects — acceptable: `await import('../src/lib/logger.js')` then log a canary object through a child with a memory stream? pino children inherit destination (stdout) — noisy but assertions can capture via `process.stdout.write` stub. Simpler: stub `process.stdout.write` during the test, log canary secrets, restore, assert output lacks values and contains `[REDACTED]`.

**Verify**: `npx vitest run tests/logging.test.js` → all pass including the 2 new tests.

## Test plan

- 2 new tests in `tests/logging.test.js` (no-secret log args; redact output check), modeled on existing tests in that file.
- Existing logging + reset-nearby suites must pass unmodified in behavior.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `grep -n "otp: code" src/services/email.service.js` → no match
- [ ] `grep -n "dev_otp\|new_password\|accessToken" src/lib/logger.js` → matches (paths present)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 009 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `sendOtpEmail`'s signature or return shape changed (the spy test depends on calling it with `{ to, name, code }`).
- Redaction breaks existing log assertions (e.g. a test asserting on a now-redacted field) — report, don't weaken the redaction to fit the test.
- Fixing requires touching delivery logic or other routes' logging.

## Maintenance notes

- Any new secret-shaped field added later must also be added to the redact list — reviewers should check this on every auth PR.
- The nodemailer `err` object at line 76 is covered by redaction now, but prefer structured `{ code: err.code }`-style logging if that line is ever rewritten.
- Deferred: central `sanitizeLog()` helper (rejected for this plan — redact list covers it with less code).
