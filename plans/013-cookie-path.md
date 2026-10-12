# Plan 013: Scope the refresh cookie to the root path and mirror attributes on clear

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/routes/auth.routes.js tests/auth.test.js`
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

The refresh cookie is set with `Path=/auth`, but the canonical refresh endpoint is `/api/v1/auth/refresh` — browsers never send the cookie there, so canonical clients silently lose refresh and get logged out after the 15-minute access token expires. Worse, signout clears with path-only options while the cookie was set with `httpOnly`/`Secure`/`SameSite`, so strict clients can keep a live refresh cookie after explicit logout. After this plan the cookie works on both mounts and logout actually logs out.

## Current state

- `src/routes/auth.routes.js:56-68` (verified at 80e106e): `issueTokens` sets `res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', path: '/auth', maxAge: 7d })` and returns `{ success: true, user, accessToken }`.
- `src/routes/auth.routes.js:146`: signout does `res.clearCookie('refreshToken', { path: '/auth' })` — attributes not mirrored.
- Canonical mounts: `src/app.js:135-146` mounts auth routes at `/api/v1` and `/`.
- Test pinning the old path: `tests/auth.test.js:32` asserts `refreshCookie` contains `Path=/auth` — update it to `Path=/`.
- Repo conventions: supertest cookie capture in `tests/auth.test.js:29-33`; `npm test`, `npm run lint`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/auth.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/routes/auth.routes.js` (cookie set + clear only)
- `tests/auth.test.js` (path assertion + new dual-mount/signout coverage)

**Out of scope**:
- Token lifetimes, rotation logic, `SameSite` value, success response bodies.
- CORS or frontend cookie handling.

## Git workflow

- Branch: `advisor/013-cookie-path`
- Commit message style: conventional — e.g. `fix: scope refresh cookie to root path, mirror attrs on clear`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Set the cookie at root path; mirror attributes on clear

- In `issueTokens`, change `path: '/auth'` → `path: '/'`. Keep `httpOnly`, conditional `secure`, `sameSite: 'strict'`, `maxAge` exactly.
- In signout, change to `res.clearCookie('refreshToken', { path: '/', httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' })` — identical attributes to set-time so strict clients drop it.

**Verify**: `grep -n "path: '/'" src/routes/auth.routes.js` → 2 matches (set + clear); `grep -n "path: '/auth'"` → no matches.

### Step 2: Update the pinned assertion + add dual-mount coverage

- `tests/auth.test.js:32`: change `Path=/auth` assertion to `Path=/`.
- Add tests in `tests/auth.test.js`: (a) signup on legacy path, then `POST /api/v1/auth/refresh` with the captured cookie → 200 with new tokens (proves canonical refresh receives the cookie); (b) `POST /api/v1/auth/signout` with the cookie, then refresh again with the old cookie → 401 (proves revocation + clear path work on the canonical mount). Extract cookies from `set-cookie` headers as the existing test does.

**Verify**: `npx vitest run tests/auth.test.js` → all pass including the 2 new tests.

## Test plan

- Updated path assertion + 2 new tests in `tests/auth.test.js` (canonical refresh works; post-signout refresh rejected).
- Full suite must pass.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `grep -n "path: '/auth'" src/routes/auth.routes.js` → no matches
- [ ] New canonical refresh + post-signout tests exist and pass
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 013 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A test client (supertest) doesn't send cookies cross-mount the way browsers do — supertest sends whatever headers you set, so set `Cookie` explicitly; if refresh-on-v1 fails for a framework reason, report the exact failure.
- Fixing requires touching token contents, lifetimes, or rotation.

## Maintenance notes

- Clients pinned to the old path behavior re-login once — note in release notes.
- Reviewer: confirm `secure` parity (both derive from the same `env.NODE_ENV === 'production'` expression — keep it that way).
- Deferred: `SameSite` policy review (stays `strict`).
