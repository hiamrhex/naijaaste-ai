# Plan 002: Establish a green verification baseline (lint gate, test harness, CI)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b739eff..HEAD -- eslint.config.js src/app.js src/NaijaTasteAI.jsx src/components/RestaurantCard.jsx package.json Dockerfile`
> Expected: only plan 001's changes to `package.json`/`Dockerfile` (deps added,
> `--omit=dev`). Anything else changed since `b739eff` → compare "Current state"
> excerpts against the live files; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-restore-backend-manifest.md
- **Category**: tests
- **Planned at**: commit `b739eff`, 2026-10-09

## Why this matters

The repo has zero tests, `npm run lint` fails with 15 errors, and the flat ESLint
config applies **browser** globals to Node backend files (so `process` is flagged
`no-undef` in `src/app.js` and `src/services/llm.service.js`). There is no CI.
Plans 003–006 change response contracts — without a red→green gate first, each
change is unauditable. This plan makes `npm run lint`, `npm test`, and
`npm run build` all exit 0, splits lint environments correctly, and runs the same
three commands on every push.

## Current state

- `eslint.config.js` — one block for everything, browser globals everywhere:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
```

- `npm run lint` currently exits 1 with exactly these 15 errors:

| File:line | Rule | Message |
|-----------|------|---------|
| `src/NaijaTasteAI.jsx:3:44,3:51` | no-unused-vars | `Users`, `TrendingUp` unused imports |
| `src/NaijaTasteAI.jsx:10:3,10:13` | no-unused-vars | `SpiceBar`, `StarBar` unused imports |
| `src/NaijaTasteAI.jsx:21:9` | react-hooks/purity | `Date.now()` called in `useState` initializer (render impurity) |
| `src/NaijaTasteAI.jsx:133:14` | no-unused-vars | `err` in `catch (err)` unused |
| `src/app.js:10:14` | no-undef | `process` not defined (browser globals applied to Node file) |
| `src/app.js:65:26` | no-unused-vars | `_next` unused (4-arg error handler — must keep the arg) |
| `src/components/RestaurantCard.jsx:8:56` | no-unused-vars | `persona` prop unused |
| `src/components/RestaurantCard.jsx:9:10,9:20` | no-unused-vars | `expanded`, `setExpanded` unused |
| `src/services/chat.service.js:28:36,67:40` | no-unused-vars | `_` in `filter(([_, v]) => …)` |
| `src/services/llm.service.js:3:33` | no-undef | `process` not defined |
| `src/services/recommend.service.js:109:13` | no-unused-vars | `_pre_score` (destructure-to-discard) |

- `src/app.js:9,73-81` — `const app = express();` is module-private and
  `app.listen(...)` runs at import time, so the app cannot be imported by a
  test (`supertest` needs the `app` without a bound port):

```js
const app = express();
...
app.listen(PORT, () => {
  console.log(` ...banner... `);
});
```

- The messages array's `ts: Date.now()` field exists at `src/NaijaTasteAI.jsx:21`
  (initializer), `:106`, `:131`, `:174` — **verified unused**: the render loop
  only reads `m.content` (`src/NaijaTasteAI.jsx:425-473`), and no other file
  reads `.ts` off messages.
- `src/components/RestaurantCard.jsx:8-9`:

```js
export function RestaurantCard({ rec, index, onReview, persona }) {
  const [expanded, setExpanded] = useState(false);
```

  (parent passes `persona={persona}` at `src/NaijaTasteAI.jsx:656` — passing an
  extra prop is not an error; only the unused destructure/state is.)
- `package.json` scripts (after plan 001): `start`, `dev:server` point at
  `src/app.js`; no `test` script. `Dockerfile:13`: `CMD ["node", "src/app.js"]`.
- Frontend is Vite/React 19 (`vite.config.js` standard template) —
  `npm run build` has never been run in this repo's history.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install dev deps | `npm install -D vitest supertest` | exit 0 |
| Lint | `npm run lint` | exit 0, 0 problems |
| Tests | `npm test` | exit 0, all pass |
| Build | `npm run build` | exit 0, `dist/` written |
| Boot smoke | plan 001's PowerShell block with `src/server.js` | `HTTP 200` |

## Scope

**In scope** (the only files you should modify):
- `eslint.config.js`
- `src/NaijaTasteAI.jsx`, `src/components/RestaurantCard.jsx` (lint fixes only)
- `src/app.js` (export app, remove listen), `src/server.js` (create)
- `package.json`, `package-lock.json`
- `Dockerfile` (CMD line only)
- `vitest.config.js` (create), `tests/api.test.js` (create)
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch, even though they look related):
- Route/service business logic (`src/routes/**`, `src/services/**`) — 003+ owns it.
- `src/constants/**`, `src/prompts/**`, `src/evaluate.js`, `src/data/**`.
- Response shapes of any endpoint (tests assert status codes only).

## Git workflow

- Branch: `master`; commit style conventional, e.g.
  `test: add verification baseline (lint gate, vitest, CI)`.
- Standing operator instruction: push after a green commit; never push on failure.

## Steps

### Step 1: Split ESLint environments and add unused-var ignore patterns

Replace `eslint.config.js` with:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const noUnused = ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: { 'no-unused-vars': noUnused },
  },
  {
    files: ['**/*.jsx'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
])
```

Rationale (so you can make the judgment call): backend is `src/**/*.js`,
frontend components are `**/*.jsx`, tooling (`eslint.config.js`,
`vite.config.js`) is `*.js` at root; `src/constants/**` is plain shared JS and
matches both the base and node blocks (harmless union).

**Verify**: `npm run lint` → the `process`/`_next`/`_`/`_pre_score` errors are
gone (7 of 15 fixed by config alone); remaining errors are only in the two JSX
files (8 of 15).

### Step 2: Fix the JSX lint errors (no rule disables)

1. `src/NaijaTasteAI.jsx:3` — remove `Users, TrendingUp` from the lucide-react
   import. `:10` — remove `SpiceBar, StarBar` from the `./components` import
   (keep `Tag, PersonaCard, RestaurantCard, ReviewModal, ThinkingDots`).
2. `src/NaijaTasteAI.jsx:21` — remove the whole `ts: Date.now(),` line from the
   `useState` initializer, and remove `ts: Date.now(),` from the three later
   message pushes (`:106`, `:131`, `:174`). **Before deleting**: run
   `Select-String -Path src\*.jsx,src\components\*.jsx -Pattern '\bts\b'` — the
   only matches must be the four definition sites (render never reads `ts`).
   If any *consumer* exists, STOP.
3. `src/NaijaTasteAI.jsx:133` — change `catch (err) {` to `catch {`.
4. `src/components/RestaurantCard.jsx:8` — drop ` persona` from the props
   destructure. `:9` — delete the `const [expanded, setExpanded] = useState(false);`
   line; then if `useState` has no remaining uses in the file, remove it from
   the line 1 import too.

**Verify**: `npm run lint` → exit 0, 0 problems.

### Step 3: Split app entry from server entry

In `src/app.js`:
- Delete line 10 (`const PORT = process.env.PORT || 3000;` — unused after this step).
- Change `const app = express();` to `export const app = express();`.
- Delete the entire `app.listen(...)` block (currently lines 73–81).

Create `src/server.js`:

```js
import { app } from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`NaijaTaste AI listening on port ${PORT}`);
});
```

(`console.log` here is deliberate — plan 004 replaces it with the structured logger.)

Update `package.json` scripts: `"start": "node src/server.js"`,
`"dev:server": "node --watch src/server.js"`.
Update `Dockerfile:13` → `CMD ["node", "src/server.js"]`.

**Verify**: `npm pkg get scripts.start` → `"node src/server.js"`; plan 001's
boot-smoke block (with `src/server.js`) → `HTTP 200`; `Select-String -Path Dockerfile -Pattern 'server.js'` → one match.

### Step 4: Install the test harness

`npm install -D vitest supertest` (exit 0). Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      // Dummy so the eager Groq client constructor at src/services/llm.service.js:3
      // succeeds in tests. Never a real key; no test performs an LLM call.
      GROQ_API_KEY: 'test-key-not-a-real-secret',
      NODE_ENV: 'test',
    },
  },
});
```

Add script `"test": "vitest run"` to `package.json`.

**Verify**: `npm pkg get scripts.test` → `"vitest run"`.

### Step 5: Write the baseline tests

Create `tests/api.test.js` (status-code assertions only — contract shapes are
owned by plan 003; every assertion here must still hold after 003 lands):

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API baseline', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.endpoints).toContain('POST /chat');
  });

  it('POST /chat without message returns 400', async () => {
    const res = await request(app).post('/chat').send({}).expect(400);
    expect(res.body.success).toBe(false);
  });

  it('GET unknown session returns 404', async () => {
    const res = await request(app)
      .get('/chat/11111111-1111-4111-8111-111111111111')
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body.success).toBe(false);
  });
});
```

No test may call the LLM (validation-failure paths only — they return before
`callLLMJson`).

**Verify**: `npm test` → exit 0, `4 passed`.

### Step 6: CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Verify**: run exactly what CI runs, locally, in order:
`npm ci && npm run lint && npm test && npm run build` → all exit 0
(`npm ci` rebuilds `node_modules` from the lockfile — this proves CI will pass
before you push).

## Test plan

- `tests/api.test.js` (4 tests, above): health contract, chat validation gate,
  session 404, unknown-route 404 — all LLM-free.
- Structural pattern: none exists yet; this file **is** the pattern — model
  future tests after it (supertest against the exported `app`, status-code +
  `success` field assertions).
- Verification: `npm test` → exit 0, 4 passed. `npm run lint` → exit 0.

## Done criteria

- [ ] `npm run lint` exits 0 with 0 problems (all 15 original errors resolved,
      zero `eslint-disable` comments added: `Select-String -Path src\*.jsx,src\*.js,src\components\*.jsx -Pattern 'eslint-disable'` → no matches)
- [ ] `npm test` exits 0, 4 tests pass
- [ ] `npm run build` exits 0
- [ ] `npm ci && npm run lint && npm test && npm run build` all exit 0 (CI parity)
- [ ] Boot smoke with `src/server.js` returns `HTTP 200`
- [ ] `npm pkg get scripts.start` → `"node src/server.js"`; Dockerfile CMD updated
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Committed and pushed (operator standing instruction) or reported green
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The lint error list in "Current state" no longer matches `npm run lint`
  (codebase drifted since `b739eff` beyond plan 001's changes).
- Fixing a lint error would require changing route/service logic (out of scope).
- `Select-String … -Pattern '\bts\b'` finds a *consumer* of the message `ts`
  field (Step 2.2).
- `npm run build` fails twice after a reasonable fix attempt — report the
  Vite error verbatim; do not start refactoring the frontend.
- A step's verification fails twice after a reasonable fix attempt.
- You discover the assumption "tests never trigger an LLM call" is false.

## Maintenance notes

- The 4-arg error handler in `src/app.js` (`(err, _req, res, _next)`) must keep
  four parameters — Express identifies error middleware by arity; the `_next`
  arg is why `argsIgnorePattern` exists.
- `vitest.config.js` sets a **dummy** `GROQ_API_KEY` for the whole test run; if
  a future test must assert real Groq behavior, add an offline fixture seam
  (direction finding) instead of real keys in CI.
- A reviewer should check the tests stay LLM-free — any test that reaches
  `callLLMJson` will burn quota or flake.
- Follow-up deferred to 003: assertions on error *bodies* (kept status-only here
  deliberately so 003 can evolve shapes without rewriting the baseline).
