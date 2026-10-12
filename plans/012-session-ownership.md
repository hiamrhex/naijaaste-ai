# Plan 012: Bind agent sessions to owners and validate session-id params

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/routes/chat.routes.js src/routes/agent.routes.js src/services/chat.service.js tests/auth.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `80e106e`, 2026-10-12

## Why this matters

Chat sessions are bearer-only: anyone holding a `session_id` UUID can read, append to, or delete anyone else's conversation — including authenticated agent turns, which share the same store with zero ownership check. Params aren't even UUID-validated, so non-UUID keys hit a raw object lookup. After this plan, agent sessions belong to the user who created them (cross-user access → 403), params are UUID-shaped (else 400), and store lookups can't return inherited properties.

## Current state

- `src/routes/chat.routes.js:30-53` (verified at 80e106e): `GET/DELETE /chat/:sessionId` call `getSession`/`clearSession` on the raw param — no auth, no UUID check. `POST /chat` validates `session_id` as UUID via `chatBodySchema` (`src/schemas/index.js:47-51`); the GET/DELETE params do not.
- `src/routes/agent.routes.js:12-26`: route requires auth, but `getSession(sessionId)` (line 17) never checks the caller owns the session; new sessions are built inline (lines 18-26) with no owner field.
- `src/services/chat.service.js:192-198`: `getSession = (sessionId) => sessionStore[sessionId] || null` — plain-object lookup, no own-key check.
- `src/services/chat.service.js:91-101`: anonymous chat auto-creates sessions for any id — keep this behavior for anonymous chat (ergonomics), only agent sessions get ownership.
- Repo conventions: `badRequest`/`notFound` helpers (`src/lib/errors.js`), `fail()` shape via `next(err)`; supertest tests with unique e-mails per run (see `tests/engagement.test.js` signup helper); `npm test`, `npm run lint`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/auth.test.js tests/api.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/routes/chat.routes.js` (param validation only)
- `src/routes/agent.routes.js` (ownership bind + check)
- `src/services/chat.service.js` (`getSession`/`clearSession` own-key hardening; `user_id` passthrough — store shape otherwise unchanged)
- `tests/auth.test.js` or new `tests/sessions.test.js` (new ownership tests)

**Out of scope**:
- Anonymous chat ergonomics (stays bearer-based).
- Session expiry/TTL, locking/concurrency (separate concern).
- Changing `POST /chat` validation.

## Git workflow

- Branch: `advisor/012-session-ownership`
- Commit message style: conventional — e.g. `fix: bind agent sessions to owners, validate session params`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Validate `:sessionId` as UUID on GET/DELETE

In `src/routes/chat.routes.js`, before lookup, reject non-UUID params with `next(badRequest('session_id must be a valid UUID'))`. UUID check: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. Unknown-but-well-formed UUIDs keep returning 404 `SESSION_NOT_FOUND` exactly as today.

**Verify**: existing `tests/api.test.js` 404 test (well-formed unknown UUID) still passes; add `GET /chat/not-a-uuid → 400` assertion to the new test file in step 3 first if you prefer red-green (optional).

### Step 2: Harden the store lookup + bind agent owners

- `src/services/chat.service.js`: change `getSession` and the `clearSession` existence check to own-key lookups: `Object.prototype.hasOwnProperty.call(sessionStore, sessionId) ? sessionStore[sessionId] : null` (same for the `if (!sessionStore[sessionId])` guards — use the hasOwnProperty form).
- `src/routes/agent.routes.js`: after resolving `session`, if `session.user_id && session.user_id !== req.user.id`, return 403 via `fail(res, { status: 403, code: 'FORBIDDEN', message: 'Session belongs to another user', requestId: req.id })`. When creating a fresh session inline (lines 18-26), set `user_id: req.user.id`. Also stamp `user_id` on sessions the agent route loads-then-saves if missing (claim-on-first-agent-use keeps old anonymous sessions usable by their first agent caller — document this choice in a code comment).

**Verify**: `npx vitest run tests/auth.test.js tests/api.test.js` → pass (no behavior change for anonymous flows).

### Step 3: Add ownership tests

Create `tests/sessions.test.js`:
1. `GET /chat/not-a-uuid` → 400 `VALIDATION_ERROR`; `DELETE` same.
2. Well-formed unknown UUID → 404 `SESSION_NOT_FOUND` (both verbs).
3. User A `POST /agent` (auth header A, no session_id) → 200 with `session_id`; user B `POST /agent` with that `session_id` → 403 `FORBIDDEN`.
4. User A reuses own `session_id` → 200 (owner OK).
5. Anonymous `GET /chat/<A's session>` still 200 (bearer ergonomics preserved — documents the remaining anonymous exposure honestly).
Signup helper: unique e-mails per run; get tokens from signup bodies (`accessToken`), following `tests/engagement.test.js`.

**Verify**: `npx vitest run tests/sessions.test.js` → all 5 pass.

## Test plan

- New `tests/sessions.test.js` (5 cases above).
- Existing api/auth suites must pass unmodified.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0 (including new `tests/sessions.test.js`)
- [ ] `npm run lint` exits 0
- [ ] `grep -n "hasOwnProperty" src/services/chat.service.js` → matches
- [ ] `grep -n "user_id" src/routes/agent.routes.js` → matches (bind + check)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 012 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `saveSession` (used by agent route line 37) overwrites `user_id` — check it preserves fields; if the session shape differs, report.
- Anonymous chat tests break (ownership must not leak into anonymous flows).
- Fixing requires touching auth middleware, token contents, or session expiry.

## Maintenance notes

- Anonymous chat sessions remain bearer-accessible by design — the next step up is binding them at creation (explicitly deferred; would change chat ergonomics).
- Reviewer: scrutinize the claim-on-first-use rule — a squatter could claim an id before its creator's first agent call; mitigations (server-issued ids only) are follow-up work.
- Deferred: per-session locking (correctness finding, separate plan).
