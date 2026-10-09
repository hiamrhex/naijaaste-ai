# Plan 007: PRD Phase 0 foundation — TypeScript agent server, Postgres, model adapter seam, CI, staging

## Status
- **Priority**: P0 (PRD §16 Phase 0, week 1) / **Effort**: L / **Risk**: MED (workspace/Docker churn, platform choices)
- **Depends on**: PRD v1.0 Phase 0 exit criteria. Independent of deferred plans 003–006 (different code).
- **Category**: feature / **Planned at**: commit `431eeea`, 2026-10-09
- **Status**: TODO — awaiting operator approval of the Decisions section

## Why this matters

PRD §16 Phase 0 exit criteria: *"Repo boots and deploys; model behind one interface;
Postgres; CI; staging live."* Every later phase sits on this seam: the Phase 1 state
machine talks to the model only through `ModelAdapter`; booking/tool data lands in
Postgres; CI is where the eval suite will eventually gate deploys (X4). Foundation
patterns done once here (typed fail-fast config, structured logs, health check,
graceful shutdown, migration discipline, typed errors) are cheap now and expensive
to retrofit in week 2 under pilot pressure.

## Decisions (approve or override — all reversible at this stage)

1. **Layout**: single repo; new TypeScript backend in **`server/`**; existing `src/`
   (discovery engine + UI) gets **zero edits** — PRD §20 defers its refactors until
   pilots are live. npm workspaces (`"workspaces": ["server"]`, one lockfile, CI
   installs once). Fallback if workspaces fight the Docker build: per-package
   `npm --prefix server ci` (STOP condition covers the switch).
2. **Runtime**: Node **24** (active LTS; local machine is `v24.12.0`). CI and
   `Dockerfile` were on EOL Node 20 (EOL Apr 2026) → both **already bumped to 24
   during the Gemini provider switch (2026-10-09)**; keep at 24 and verify.
   `engines: ">=22.12"`.
3. **Tooling**: TypeScript ESM (`module: NodeNext`), `tsx` dev watch, `tsc`
   build + `--noEmit` typecheck, Vitest (same harness family as existing), root
   `eslint.config.js` extended with a `typescript-eslint` block for `server/**/*.ts`.
   Root vitest already pins `include: ['tests/**/*.test.js']` so legacy and server
   suites stay separated; server gets its own `server/vitest.config.ts`.
4. **Database**: PostgreSQL via **Drizzle ORM + drizzle-kit** — schema-as-code with
   generated SQL migration files (where future RLS policies live as raw SQL).
   Alternative rejected for now: Prisma (heavier, awkward RLS story). Local DB =
   new compose service; CI = `postgres:16-alpine` service container; staging =
   managed Postgres on the host.
5. **Model seam** (PRD §20: model behind one interface with a fixture adapter
   for offline tests): `ModelAdapter` interface + `GeminiAdapter` (@google/genai,
   default model `gemini-3.8-flash` — chosen in the 2026-10-09 Gemini switch) +
   `FixtureAdapter` (deterministic JSON fixtures, zero network) + factory keyed on
   `MODEL_PROVIDER`. Second-provider failover is an interface slot only — PRD open
   question ("which second provider") → decided in Phase 1.
6. **Staging host**: **Railway** (production already runs there —
   `naijaaste-ai-production.up.railway.app`), separate staging project/service +
   managed Postgres; region picked by latency test from Nigeria (PRD §12). Service
   creation, secrets, and region selection are **operator console steps** (account
   + billing); the executor prepares deploy config and documents the runbook.
7. **Conventions for the new server only**: adopt plan 003's error contract from
   day one (`AppError{status, code, message, details}` → body
   `{ success:false, error:{code,message}, requestId }`) so old-code plan 003 and
   the new server share vocabulary when it resumes; `pino` structured logging +
   request logging; graceful SIGTERM shutdown. Old-code plans 003–006 stay
   deferred.
8. **Schema slice**: migration framework + first table **`tenants`** (PRD §12 data
   model subset, foundation for X1 tenant isolation). Remaining tables, RLS
   policies, and the `SET LOCAL app.tenant_id` session pattern land in Phase 1
   when query surfaces exist.

## Current state (post plan 002)

- `package.json`: workspaces absent; scripts `start`/`dev:server` = legacy JS API;
  `test` = `vitest run` (root config includes only `tests/**/*.test.js`, env stubs
  `GEMINI_API_KEY`); lint 0 errors; 4 tests green.
- CI (`.github/workflows/ci.yml`): single `verify` job — checkout, **Node 24**
  (bumped 2026-10-09 with the Gemini switch), `npm ci`, lint, test, build. No
  Postgres, no typecheck, no server job.
- `Dockerfile`: `node:24-alpine` (bumped 2026-10-09), `COPY package*.json ./`,
  `npm ci --omit=dev`,
  `CMD ["node","src/server.js"]`. Note: once `server/` joins the workspace,
  `npm ci` requires `server/package*.json` present too — COPY line must change.
- `docker-compose.yml`: one legacy service (`naijaaste-ai`, :3000). No database.
- `eslint.config.js`: flat config covering `**/*.{js,jsx}` only — no TS parser yet.
- No TypeScript anywhere (only `@types/react*` for JSX tooling).
- `.env.example`: `GEMINI_API_KEY`, `GEMINI_MODEL`, `PORT`. No `DATABASE_URL`.
- Local toolchain: Node `v24.12.0`, npm `11.6.2`. Docker CLI hung once during this
  session — preflight must bound-check it.
- No staging environment exists; production Railway URL must remain untouched.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install (workspace) | `npm install` | lockfile updated, no errors |
| Typecheck server | `npm run -w server typecheck` | exit 0 |
| Lint (legacy+TS) | `npm run lint` | exit 0 |
| Legacy tests | `npm test` | exit 0, 4 tests |
| Server tests | `npm run -w server test` | exit 0 (db suite skips w/o `DATABASE_URL`) |
| Local Postgres | `docker compose up -d postgres` | healthy within ~30s |
| Migrate | `npm run db:migrate` | `tenants` created |
| Dev server | `npm run server:dev` then `curl :4000/health` | 200, `db:"up"` |
| Build server | `npm run -w server build` | `server/dist/` emitted |
| Legacy image | `docker build -t naijataste-legacy .` | exit 0 |
| Live adapter smoke (optional) | `GEMINI_API_KEY=... npm run -w server test` | Gemini suite unskipped |

## Scope

**In scope** (the only files you should modify):
- `server/**` (new: package.json, tsconfig, src/, drizzle/, tests, vitest config)
- `package.json` + `package-lock.json` (workspaces, scripts, engines)
- `eslint.config.js` (TS block for `server/**/*.ts`)
- `.github/workflows/ci.yml` (Node 24, server job + postgres service)
- `Dockerfile` (base already node:24 — verify; workspace COPY fix), `docker-compose.yml` (postgres)
- `.env.example` (DATABASE_URL, MODEL_PROVIDER, LOG_LEVEL)
- `railway.json` (new — staging deploy config)
- `README.md` (server + staging section), `plans/007-phase0-foundation.md` (this
  file, only per reviewer instructions), `plans/README.md` (reviewer only)

**Out of scope** (STOP if a step seems to require these):
- Any file under `src/` — zero edits, hard boundary (PRD §20)
- WhatsApp/Meta integration, Paystack, webhook gateway, state machine, agent
  tools, conversation/booking tables (Phase 1)
- Redis/queue, Sentry, feature flags, custom domain/WAF (later PRD phases)
- Selecting the second model provider (PRD open question)
- Old-code hardening plans 003–006 (deferred until pilots are live)
- The existing production Railway service (its config, URL, or deploys)

## Steps

### Step 0: Preflight (bounded checks — do this first)
1. `node -v` → must be ≥ 22.12 (expected `v24.12.0`).
2. `docker info` with a bounded timeout → if it hangs/fails (observed once on
   2026-10-09), report STOP: local DB verification impossible; operator must start
   Docker Desktop before continuing.
3. Confirm clean tree: `git status --short` empty.

### Step 1: Workspace skeleton
1. Root `package.json`: add `"workspaces": ["server"]`,
   `"engines": { "node": ">=22.12" }`, and scripts
   (`server:dev`, `server:build`, `server:start`, `server:typecheck`, `server:test`,
   `db:migrate` → delegate via `npm run -w server ...`). Leave existing scripts
   untouched. Add `typescript-eslint` to root devDependencies (root eslint config
   imports it).
2. `server/package.json`: `"type": "module"`; deps: `express@^4`, `zod`, `pg`,
   `drizzle-orm`, `@google/genai`, `pino`, `pino-http`, `dotenv`; devDeps: `typescript`,
   `tsx`, `vitest`, `drizzle-kit`, `@types/express`, `@types/node`, `@types/pg`.
   Scripts: `dev` = `tsx watch src/index.ts`, `build` = `tsc`, `typecheck` =
   `tsc --noEmit`, `start` = `node dist/index.js`, `test` = `vitest run`,
   `db:generate` = `drizzle-kit generate`, `db:migrate` = `drizzle-kit migrate`.
3. `server/tsconfig.json`: `strict: true`, `module/moduleResolution: NodeNext`,
   `target: ES2023`, `outDir: dist`, `rootDir: src`, `include: ["src"]`
   (typecheck script reuses it; tests covered by a second tsconfig include or
   `tsconfig.test.json` — pick whichever passes cleanly).
4. `eslint.config.js`: add a block for `server/**/*.ts` extending
   `js.configs.recommended` + `typescript-eslint` recommended, node globals,
   same `no-unused-vars` shape adapted for TS (`@typescript-eslint/no-unused-vars`
   with the same ignore patterns).
5. `server/vitest.config.ts`: node environment, `include: ['src/**/*.test.ts',
   'tests/**/*.test.ts']`, `env` stubs (`GEMINI_API_KEY` dummy, `NODE_ENV: 'test'`).
6. Minimal `server/src/index.ts` that just imports config (Step 2) — or a
   placeholder that logs "phase0" — until Step 5.
7. **Verify**: `npm install` (lockfile committed), `npm run lint` (legacy results
   unchanged, TS parsed), `npm test` (still 4), `npm run -w server typecheck`.

### Step 2: Fail-fast config, errors, logging (server only)
1. `server/src/config.ts`: zod schema over `process.env` (after
   `import 'dotenv/config'`):
   - `NODE_ENV` ∈ development|test|staging|production (default development)
   - `PORT` coerce number, **default 4000** (never collide with legacy :3000)
   - `DATABASE_URL` — url, required unless pure unit-test context
   - `MODEL_PROVIDER` ∈ gemini|fixture (default gemini); `GEMINI_API_KEY` required iff
     provider = gemini (clear aggregated error message listing missing vars —
     fail fast on boot)
   - `GEMINI_MODEL` default `gemini-3.8-flash`; `LOG_LEVEL` default `info`
2. `server/src/lib/errors.ts`: `AppError(status, code, message, details?)` +
   `badRequest`/`notFound`/`internal` helpers using plan 003's code vocabulary
   (`VALIDATION_ERROR`, `SESSION_NOT_FOUND`-style fixed codes, `INTERNAL`).
3. `server/src/lib/logger.ts`: pino from config; `pino-pretty` transport only in
   development (add `pino-pretty` devDep). Never log message bodies (PII).
4. `server/src/middleware/`: `requestId` (honor valid inbound `X-Request-Id`,
   else `crypto.randomUUID()`, set response header), `pino-http` request logging,
   `errorHandler` returning the plan-003 body shape with `requestId`, plus a
   JSON 404.
5. **Verify**: unit tests — bad env throws with listed keys; error handler maps
   `AppError`/unknown error correctly; request id round-trips.

### Step 3: Model adapter seam
1. `server/src/adapters/types.ts`:

```ts
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface CompletionRequest {
  messages: ChatMessage[];
  scenario?: string;            // fixture lookup key (tests/evals)
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
}
export interface CompletionResult {
  content: string;
  provider: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
  latencyMs: number;
}
export interface ModelAdapter {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
```

2. `GeminiAdapter`: wraps `@google/genai` `ai.models.generateContent`; maps
   `usageMetadata` to usage and captures latency; `json` →
   `config.responseMimeType: 'application/json'`; timeout via SDK
   `HttpOptions.timeout`; map SDK `ApiError` to
   `AppError(502, 'UPSTREAM_FAILURE', ...)`; `temperature` is deprecated for
   Gemini 3 models — accept it on the interface but do not send it; logs
   provider/model/latency/tokens only — never content.
3. `FixtureAdapter`: `scenario` → JSON file under
   `server/src/adapters/fixtures/`; unknown scenario → throw (fail loud, no
   silent guess); zero network.
4. `server/src/adapters/index.ts`: `getModelAdapter(config)` factory
   (provider switch; the failover decorator is a documented empty slot for
   Phase 1).
5. **Shared contract test** (`server/src/adapters/contract.test.ts`) run against
   every adapter: fixture — always; gemini — `describe.skipIf(!GEMINI_API_KEY)` live
   single-completion smoke (CI runs green without secrets; operator can run it
   locally with the real key). Tests assert result shape, usage ≥ 0, non-empty
   content, and that fixture mode performs no network I/O (by construction:
   no Gemini client constructed when provider=fixture).
6. **Verify**: `npm run -w server test` offline green; with real key, Gemini suite
   unskips.

### Step 4: Postgres, migrations, health
1. `docker-compose.yml`: add `postgres` service (`postgres:16-alpine`,
   `POSTGRES_PASSWORD` default dev-only, `POSTGRES_DB: naijataste`, healthcheck
   `pg_isready`, named volume, `5432:5432`). **Do not touch** the legacy service.
2. `server/drizzle.config.ts` + `server/drizzle/` migrations; schema at
   `server/src/db/schema.ts`:

```ts
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['active', 'paused'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

3. `server/src/db/index.ts`: `pg` Pool (bounded max, connectionTimeoutMillis
   short so health fails fast), `checkDb()` one-shot `SELECT 1`, `closeDb()`.
4. `server/src/app.ts`: `createApp(deps)` factory (injectable adapter/pool for
   tests) — requestId → pino-http → routes → 404 → error handler.
   `GET /health` → `{ status, service, version, db: 'up'|'down', uptimeMs }` —
   **200** when `checkDb()` succeeds, **503** when it fails.
5. `server/src/index.ts`: load config → build adapter + pool → `createApp` →
   listen → register `SIGTERM`/`SIGINT`: stop accepting, drain with timeout,
   `closeDb()`, exit 0. Log boot line with port/provider/node env.
6. Integration test (`server/src/db/tenant.integration.test.ts`): runs only when
   `DATABASE_URL` set (else skip with message); migrates a fresh schema, inserts
   a tenant, asserts unique-`slug` violation surfaces as typed error.
7. **Verify**: `docker compose up -d postgres` healthy;
   `npm run db:migrate`; `npm run -w server test` (integration unskipped);
   `npm run server:dev` + `curl :4000/health` → 200 `db:"up"`; stop DB → 503.

### Step 5: CI extension
1. `verify` job: `node-version: 24` (rest unchanged).
2. New `server` job (same triggers): setup-node 24 + npm cache → `npm ci` →
   `npm run lint` → `npm run -w server typecheck` → `npm run -w server build` →
   `npm run db:migrate` with env `DATABASE_URL` pointing at job-level
   `services: postgres` (`postgres:16-alpine`, `pg_isready` health options,
   creds matching the URL) → `npm run -w server test` (integration unskips).
3. Add non-blocking dependency scan: `npm audit --audit-level=high` with
   `continue-on-error: true` (blocking + secret scanning = next CI pass; note in
   report).
4. **Verify**: all commands above reproduce locally (except service container,
   which CI provides); workflow YAML validated (`actionlint` if available, else
   careful review). Final CI-green confirmation happens post-merge on master —
   same protocol as plans 001/002.

### Step 6: Legacy Dockerfile fix (still in scope — "repo boots and deploys")
1. Base `node:24-alpine`; `COPY package*.json ./` +
   `COPY server/package*.json server/` **before** `npm ci` (workspace lockfile
   needs both manifests); keep `--omit=dev` + `CMD ["node","src/server.js"]`
   (legacy app only — server deploys via Railway build config, not this image).
2. **Verify**: `docker build -t naijataste-legacy .` exit 0; image boots with
   dummy key → `:3000/health` 200 (same smoke as plan 002).

### Step 7: Staging deploy — executor prepares, operator executes
1. Executor adds `railway.json` at repo root:
   `{"build": {"builder": "NIXPACKS"}, "deploy": {"startCommand": "npm ci &&
   npm run -w server db:migrate && npm run -w server build && npm run -w server
   start", "restartPolicy": "ON_FAILURE"}}` (single instance Phase 0 — migrate
   before start is safe; multi-instance → dedicated release phase in Phase 1).
2. Operator runbook (document in README "Staging" section):
   - Latency test from a Nigerian network to the host's candidate regions
     (`curl -o /dev/null -w '%{time_total}\n' https://<region-health-host>`,
     3 samples each) → pick region (PRD §12).
   - Create Railway project `naijataste-staging` → new service from this repo
     (master), region chosen above; add managed Postgres; set env:
      `NODE_ENV=staging`, `DATABASE_URL`, `GEMINI_API_KEY`, `MODEL_PROVIDER=gemini`,
      `LOG_LEVEL=info`.
   - Verify from outside: `curl https://<staging-host>/health` → 200 with
     `db:"up"`; record URL + chosen region in README.
   - Regression guard: production `https://naijaaste-ai-production.up.railway.app/health`
     still 200 (this plan never touches that service).
3. **Verify**: staging URL live (operator), production untouched.

### Step 8: Docs + handoff
1. README: new "Agent server (Phase 0)" section — scripts, config table,
   staging URL; update project-structure tree with `server/`.
2. Report per format; reviewer flips `plans/README.md` row 007 → DONE and pushes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm ci` at root installs the workspace cleanly; lockfile committed
- [ ] `npm run lint` exit 0 (legacy rules unchanged, `server/**/*.ts` covered)
- [ ] `npm test` exit 0 (legacy 4 unchanged) and `npm run -w server test` exit 0
      (config/error/adapter suites; DB integration unskipped in CI)
- [ ] `npm run -w server typecheck` exit 0; `npm run -w server build` emits `dist/`
- [ ] `docker compose up -d postgres` → `npm run db:migrate` → `tenants` table
      exists (assert via `psql`/test)
- [ ] `GET :4000/health` → 200 `{db:"up"}` with DB up; 503 with DB down
- [ ] Fixture adapter contract suite passes with **zero** network calls; gemini live
      suite skips without `GEMINI_API_KEY`, passes with it (operator spot-check)
- [ ] CI defines `verify` (Node 24) + `server` (typecheck/build/test against
      Postgres service) jobs; all their commands reproduce locally; master push
      shows green after merge
- [ ] `docker build` of legacy Dockerfile exit 0; image smoke 200 on :3000
- [ ] Staging `/health` 200 with `db:"up"` from outside; URL + region recorded in
      README (operator step)
- [ ] `git diff --name-only master...HEAD` contains **zero** paths under `src/`
- [ ] No secrets in the diff; `.env.example` gained only placeholder keys
- [ ] `plans/README.md` row 007 = DONE (reviewer, at merge time)

## STOP conditions

Stop and report (do not improvise) if:

- Docker is unreachable and the operator cannot start it → local DB criteria
  unverifiable.
- npm workspaces break the legacy install, `npm test`, `npm run build`, or the
  Docker build after 2 reasonable fix attempts → propose the `--prefix` fallback
  layout (needs approval).
- Any step appears to require editing a file under `src/` → hard boundary.
- Railway has no region acceptable from the latency test, or no managed Postgres
  plan available → propose alternatives (Neon, Supabase, Fly) for the operator.
- Local Node < 22.12 and cannot be upgraded.
- The existing production Railway project demands changes for staging to exist
  (separate project should not) → stop, operator decision.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Phase 1 consumes this seam**: remaining PRD tables (Guest, Conversation,
  Message, Booking, Payment, …) as new migrations; RLS pattern
  (`ALTER TABLE … ENABLE ROW LEVEL SECURITY` + app role + `SET LOCAL`) written
  as raw SQL in migration files; webhook gateway → queue → worker all construct
  state-machine turns through `ModelAdapter`; second provider slots into the
  factory when the PRD open question is answered.
- Error vocabulary (`AppError` codes) is shared with deferred plan 003 — when
  003 resumes, port its tests against the same contract.
- gitleaks/secret scan, Sentry, feature flags (PRD stack) → next CI/observability
  pass, not this plan.
- Plans 003–006 remain deferred until pilots are live (PRD §20).
- Operator parallel track (PRD §16): Meta business verification + template
  approval start week 1 — non-code, tracked by the operator, not this plan.
