# PROOF

Evidence log. Every entry is **claim -> command -> result**. "Written" is not
"executed": if there is no command output under a claim, the claim is unproven.

---

## Phase 0.1 — a session requires a proven mailbox

**Claim:** before the change, `/auth/signup` minted access + refresh tokens for
an address nobody had proven they control.

**Command:**
```powershell
npx vitest run tests/auth-email-verification.test.js --reporter=verbose
```

**Result (pre-fix, 2026-11-17 22:04):**
```
Tests  7 failed (7)
  → expected 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…' to be undefined   (a: token handed out at signup)
  → expected 200 to be 403                                             (b: stale token accepted)
  → expected 200 "OK", got 404 "Not Found"                             (c: no verify endpoint)
  → expected 404 to be 400                                             (d: no attempts on signup codes)
  → expected 'VALIDATION_ERROR' to be 'INVALID_OTP'                    (e: reset endpoint rejects shape first)
  → expected 201 "Created", got 409 "Conflict"                         (f: squatter keeps the address)
  → expected undefined to be true                                       (g: google users have no flag)
```

**Claim:** after migration 010 + 011 and the route changes, the same suite
passes, and the rest of the suite still passes.

**Command:**
```powershell
npx vitest run tests/auth-email-verification.test.js   # 7 passed
npx vitest run                                         # 99 files, 593 tests
npm run lint                                           # clean
```

**Result (post-fix):**
```
tests/auth-email-verification.test.js   7 passed (7)
Test Files  99 passed (99)
Tests       593 passed (593)
eslint .  -> no output
```

**Side evidence (DDL compatibility probe, executed then deleted):** pg-mem
accepted `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`,
`CREATE UNIQUE INDEX IF NOT EXISTS` and `ON CONFLICT (email, purpose)` before
the migrations were written. The full suite then applied both migrations on
every test file's fresh database — that is the real proof.

**Not proven here:**
- The migrations have **not** run against a real Postgres/Neon instance.
  `npm run db:migrate` needs `DATABASE_URL_DIRECT`; that is Phase 1.1/1.3 work.
- The SPA still expects `accessToken` from `/auth/signup`; no frontend change
  was made in this task.
- Rate limits are still per-process (Phase 0.6); JWT length floor is Phase 0.5.
