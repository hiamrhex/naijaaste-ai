# Plan 015: Close the auth enumeration oracles and make the OTP reset seamless

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a23986c..HEAD -- src/routes/auth.routes.js src/auth/otp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a23986c`, 2026-10-20

## Why this matters

The auth surface was audited end to end (signup → signin → refresh → signout →
forgot/reset → Google). The happy path worked; the edges leaked:

1. **Account enumeration through the resend cooldown.** `forgot-password`
   answered a second request inside the 60 s cooldown with `429
   RESEND_COOLDOWN` for a *known* account and `200` for an unknown one. The
   endpoint's own comment promised "always returns 200 for unknown emails (no
   account enumeration)" — the cooldown broke that promise. One bit per
   account, no rate limit needed.
2. **Account enumeration through response time.** `signin` returned `401` for
   an unknown email *before* the bcrypt call, so an unknown address answered
   in ~5 ms while a known one took ~300 ms.
3. **No brute-force brake on credentials.** The only control was a shared
   20-per-15-minutes IP bucket, which is simultaneously too loose for
   spraying many accounts and too tight for a Nigerian carrier-grade NAT,
   where a whole neighbourhood shares one address.
4. **The reset flow was needlessly hard to use.** Requesting a code and
   guessing a code drew from one 10-per-15-minutes bucket, so the 5-attempt
   per-code lockout was unreachable in practice and a user who mistyped their
   code could be shut out of the whole flow.
5. **Weak-password and cache hygiene gaps.** Any 8-character string was
   accepted (`password123` included), and token-bearing responses carried no
   `Cache-Control`.

After this plan the reset journey works end to end, no response distinguishes
a registered email from an unregistered one, and repeated guessing is bounded
by a lockout that cannot be used against a victim.

## Current state

- `src/routes/auth.routes.js:16-30` (verified at `a23986c`): one `authLimiter`
  (max 20 / 15 min) guarded signup, signin, refresh and Google together; a
  separate `resetLimiter` (max 10 / 15 min) guarded both `forgot-password` and
  `reset-password` and answered with a hand-rolled body that carried no
  requestId and no `Retry-After`.
- `src/routes/auth.routes.js:215-244` (verified at `a23986c`): `forgot-password`
  returned `429 RESEND_COOLDOWN` when `issueOtp` threw.
- `src/routes/auth.routes.js:93-114` (verified at `a23986c`): `signin` returned
  `401` before `bcrypt.compare` when the user was missing.
- `src/auth/otp.js:71-101` (verified at `a23986c`): the attempt counter was
  read-then-written (`SELECT` → `UPDATE`), so two concurrent guesses could
  spend the same attempt.
- `src/saved_places/store.js:44-99` (verified at `a23986c`): the 50-place cap
  relied on `SELECT ... FOR UPDATE`. pg-mem - the driver the test suite runs
  on - parses `FOR UPDATE` but does not honour row locks, so the cap was a
  no-op there.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/auth-otp.test.js tests/auth-limits.test.js tests/reset-nearby.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| e2e | `npx playwright test` | all pass |

## Scope

**In scope**:
- `src/routes/auth.routes.js` (limiters, signin, forgot/reset, no-store, requestId)
- `src/auth/otp.js` (cooldown bypass, atomic attempt accounting)
- `src/auth/lockout.js` (new), `src/auth/password.js` (new)
- `src/services/email.service.js` (export the dev-OTP predicates)
- `src/db/pool.js` (transient-connection retry, TCP keepalive)
- `src/saved_places/store.js` (portable cap enforcement)
- `src/env.js` (auth limit knobs), `migrations/004_auth_lockout.sql` (new)
- `tests/auth-otp.test.js` (new), `tests/auth-limits.test.js` (new),
  `tests/e2e/auth-otp.spec.js` (new), `tests/reset-nearby.test.js`
- `vitest.config.js` (tests run on pg-mem, exactly like CI)
- `docs/API.md`, `docs/SECURITY.md`, `docs/THREAT_MODEL.md`, `CHANGELOG.md`

**Out of scope**:
- Token lifetimes, rotation logic, `SameSite` value, cookie attributes.
- Google sign-in internals.
- The frontend API-client refactor (separate effort).

## Git workflow

- Commit message style: conventional — e.g. `fix(auth): close enumeration oracles, harden reset flow`
- Push only when every Done criterion passes.

## Steps

### Step 1: One limiter per flow, on the project's error contract

Replace the shared `authLimiter` with per-route buckets (signup / signin /
refresh / google / forgot / reset), each answering through the shared
`{ error: { code, message, requestId } }` shape with `Retry-After` and
draft-7 `RateLimit` headers. Limits move to env knobs
(`AUTH_RATE_LIMIT_*_MAX`) so they can be tuned without a deploy, and they stay
generous because carrier-grade NAT makes a tight IP budget harmful.

**Verify**: `npm run lint` → exit 0; `npx vitest run tests/auth-limits.test.js` → passes.

### Step 2: Kill the enumeration oracles

- `forgot-password` always answers `200` with the same body for known and
  unknown emails; the resend cooldown still protects the mailbox but is no
  longer observable. In dev (no SMTP, code surfaced in the response) the
  cooldown is bypassed so the caller always gets a usable code.
- `signin` always pays the bcrypt cost — a missing account compares against a
  throwaway hash — so an unknown email costs the same wall-clock time.

**Verify**: `npx vitest run tests/auth-otp.test.js` → the "no account
enumeration" block passes.

### Step 3: Brute-force lockout that cannot be aimed at a victim

New `src/auth/lockout.js` + `migrations/004_auth_lockout.sql`: ten failed
sign-ins lock the `(email, ip)` pair for 15 minutes. Keyed on the pair, not
the account, so an attacker cannot lock a victim out; failures are counted for
unknown emails too, so the lock fires identically either way.

**Verify**: `npx vitest run tests/auth-otp.test.js` → the lockout block passes.

### Step 4: Make the reset flow seamless

- Atomic OTP attempt accounting (`UPDATE ... WHERE attempts < max RETURNING`).
- Separate budgets for requesting a code and guessing one.
- Password policy: length-first, plus a common-password denylist and a check
  that the password is not derived from the account's email.

**Verify**: `npx vitest run tests/auth-otp.test.js tests/reset-nearby.test.js` → pass.

### Step 5: Response hygiene and a portable cap

- `Cache-Control: no-store` on every auth response.
- `requestId` on every auth error body.
- The 50-place cap is enforced by a per-user in-process lock as well as the
  database row lock, so it holds on pg-mem (tests) and Postgres (production).
- `src/db/pool.js` retries a statement once on a connection-level failure
  (the pooled Postgres endpoint can close an idle socket) instead of
  answering 500.

**Verify**: `npm test` → all pass; `npm run build` → exit 0.

### Step 6: Prove the journey in a browser

`tests/e2e/auth-otp.spec.js` drives the real UI: signup → sign out → forgot
password → read the surfaced code → reset → sign in with the new password. CI
sets `DEV_OTP_ENABLED=true` (the server refuses to surface the code in
production).

**Verify**: `npx playwright test` → 2 passed.

## Test plan

- `tests/auth-otp.test.js` (new, 18 cases): the full reset journey, replay,
  cross-account codes, expiry, attempt accounting, enumeration parity, timing
  parity, lockout, password policy, cache headers.
- `tests/auth-limits.test.js` (new, 2 cases): the 429 contract on two buckets.
- `tests/e2e/auth-otp.spec.js` (new): the reset journey in the browser.
- `tests/reset-nearby.test.js`: the resend case now asserts the generic
  answer instead of `429 RESEND_COOLDOWN`.
- Full suite must pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `npx playwright test` exits 0
- [ ] `grep -n "RESEND_COOLDOWN" src/routes/auth.routes.js` → no matches
- [ ] `grep -n "RESEND_COOLDOWN" tests/` → no matches
- [ ] `grep -n "authLimiter" src/routes/auth.routes.js` → no matches
- [ ] New auth + OTP + lockout tests exist and pass
- [ ] `plans/README.md` status row for 015 updated
- [ ] `docs/API.md`, `docs/SECURITY.md`, `docs/THREAT_MODEL.md` describe the new behaviour

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A change would require altering token contents, lifetimes, or rotation.
- The per-user cap lock changes observable behaviour for the saved screen
  beyond what the existing tests assert.

## Maintenance notes

- The lockout is per `(email, ip)`: a user who fat-fingers their password ten
  times from the same address waits out 15 minutes. Clear the row from the
  admin console if a legitimate user is caught out.
- `AUTH_RATE_LIMIT_*` are env knobs — tune them without a deploy, but keep
  them generous: carrier-grade NAT is the normal case for this audience.
- The dev-OTP cooldown bypass only applies when the code is surfaced in the
  response, i.e. when there is no inbox to protect.
