# Baseline Audit — scored against `docs/STANDARDS.md`

> **RE-SCORE 2026-10-19 (agent-assisted — see bias disclosure).** The original
> scoring below was produced by the same agent that built the fixes, so per the
> operating contract it is not trusted as final. This section re-scores the same
> 25 checks from fresh evidence created today in a separate probes session
> (`EVIDENCE.md`, IDs `T19-01…T19-20`). Tests/lint/build/secret-scan re-run
> green today (T19-16). Live site probed for the first time while booted
> (T19-01…T19-07). **Result: 58/75 = 77%** — three rows drop from the prior 81%.

## Re-score table (2026-10-19, fresh evidence only)

| # | Check | Prior | Fresh | Why it moved | Evidence |
|---|---|---|---|---|---|
| 1 | BOLA ownership | 3 | 3 | unchanged; + saved-places proven owner-scoped live (B sees 0 rows) | T19-08 |
| 2 | Tokens/expire | 3 | 3 | live signin ✓ + cookie flags ✓; tamper/reuse probes NOT re-run today (last 2026-10-15) | T19-02 |
| 3 | Mass assignment | 2 | 2 | `role`-stripping test still absent | — |
| 4 | Bounded consumption | 3 | **2** | saved-places 50-cap exceeded 12/12 under parallel writes (no backstop); stacked limiter headers confusing (600 vs 20) | T19-11, T19-04 |
| 5 | Function authz | 3 | 3 | unchanged (not re-probed today) | — |
| 6 | Sensitive-flow gates | 2 | 2 | live reset-bomb drill still not run | — |
| 7 | SSRF | 2 | 2 | unchanged | — |
| 8 | Secure defaults | 3 | 3 | live headers verified today (HSTS/CSP/COOP/nosniff; CORS fail-closed) | T19-02, T19-05 |
| 9 | Route inventory truth | 3 | **2** | `/health` advertises `/api/v1/*` as canonical; those paths **404 live**; SPA ships `/api/auth/*` | T19-03 |
| 10 | Upstream validated | 3 | 3 | unchanged | — |
| 11 | Prompt injection | 2 | 2 | 5-probe battery unchanged; not re-run vs live model | — |
| 12 | Sensitive disclosure | 2 | 2 | unchanged; saved-places stores hostile text verbatim (latent redaction-relevant) | T19-09 |
| 13 | Least-priv tools | 2 | 2 | unchanged | — |
| 14 | Sysprompt leakage | 2 | 2 | unchanged | — |
| 15 | LLM consumption cap | 2 | 2 | anon burn blocked live ✓ (T19-06); no monthly counter remains | T19-06 |
| 16 | SLOs measured | 2 | 2 | doc exists; **nothing computes/alerts still** | — |
| 17 | Graceful degradation | 3 | 3 | drills stand; fallback paths exercised in today's suite | T19-16 |
| 18 | Disposability | 2 | 2 | unchanged | — |
| 19 | Timeout/backoff/breaker | 3 | 3 | unit-proven; stands | T19-16 |
| 20 | Backing services/PITR | 2 | 2 | DB live ✓ (T19-01); Neon-branch PITR still unverified | T19-01 |
| 21 | Config in env | 3 | 3 | scan clean today (219 files) | T19-16 |
| 22 | Logs/alerts | 1 | 1 | **no monitor today**; the last outage was caught by manual curl | MATURITY top-5 |
| 23 | Runbooks/postmortems | 3 | 3 | docs stand | — |
| 24 | CI gates | 2 | 2 | lint+build+vitest+sw+audit green locally; Lighthouse/branch-proof still absent | T19-16 |
| 25 | Parity/migrations | 3 | **2** | dev/prod parity **broken for canonical paths** (`/api/v1/*` 404 live); migration 003 applied (schema live via working POST) | T19-03, T19-08 |

**Re-score total: 58/75 = 77% (agent-assessed).**

### Bias disclosure (required by operating contract §1.3)

Three strongest reasons this score is probably too generous:

1. **Auditor = builder.** The same agent family wrote the code and wrote most
   fixes earlier in the program; every "3" borrowed without today's re-proof
   (rows 2, 5, 7, 10–14, 17–24) stands on evidence the builder curated.
2. **Coverage is narrow where it is fresh.** Today's live probing is one account,
   one AI call, saved-places happy paths + one race — a single-surface snapshot,
   not a battery; auth abuse, injection and reset flows were not re-run live.
3. **Documentation-input scoring.** Rows 6, 7, 11, 13, 16 score design intent
   (docs + absence of code), not measured behaviour; a harsh reviewer weights
   running systems higher and docs lower, and three of the four top risks are
   the same ones left open since 2026-10-16 (monitoring, SLO aggregation, PITR).

**Recommendation: an independent reviewer (different model or human) re-scores
before this figure is cited anywhere public.**

## New findings this session (report-only, not yet in the gap table)

- **F1 — Canonical-path 404 live (check 9/25).** `vercel.json` rewrites
  `/api/:path*`→function; `api/index.js:12-14` strips the `/api` prefix;
  router mounts `/api/v1` (needs the prefix intact) and `/` (gets the stripped
  path). `/api/v1/auth/signup` → `ROUTE_NOT_FOUND /v1/auth/signup` live.
  SPA works because it ships `/api/auth/*` (constants/index.js:7). Docs/health
  contract says `/api/v1` is canonical — neither notation the *docs* promise
  works for external clients except `/api/*`.
- **F2 — saved-places capability gaps.** No DELETE/PATCH endpoints (T19-13):
  a mistake or a full 50-cap is permanent for that user (SQLite-level cleanup
  only). 150→100 truncation is silent (T19-10). Hostile names stored verbatim
  (T19-09) — safe today because React escapes, latent for email/admin surfaces.
- **F3 — 50-cap race.** Count-then-insert; 12 parallel = 12 accepted (T19-11).
- **F4 — Rate-limit header confusion.** Two stacked limiters both emit draft-7
  headers (`limit=600` vs `limit=20;w=900`) on the same response (T19-04).
- **F5 — Doc drift.** README/API.md badge 156 tests vs actual 159; README line 11
  claims "API function not yet serving" — contradicted by live 200s today (T19-01).
- **F6 — check-ng-data undeclared deps** `ajv`/`ajv-formats` (T19-18), and the
  data itself has 17 duplicate keys + 40 unresolved source_refs (T19-17) — exit 0
  on warnings, so CI quality gates for this data would pass while corrupt/dirty.
- **F7 — pg SSL-mode deprecation warning** surfaced in test logs
  (`verify-full` aliasing change in pg v9) — currently cosmetic; adopt.
- **F8 — Product gap.** `area`/`maxPrice` filters on SavedScreen are client-only
  state; a user's saved list cannot be filtered server-side, incongruent with
  "Planner" promise; minor.

### Top 10 risks, re-ranked 2026-10-19 (by impact on real users)

1. **No monitoring/alerting on a now-LIVE system** (check 22, T19-16 context).
   The API boots and users can sign up; when it dies nothing says so — outages
   were found by manual curl last time.
2. **Canonical-path 404 live** (F1). Any external client, integration, script,
   or monitor written against the *documented* `/api/v1/*` contract fails; only
   undocumented `/api/*` works. Blocks SLO machines, uptime checks, partners.
3. **No SLO p95 computation or burn alert** (check 16). Dead-letter doc for as
   long as it stays closed.
4. **saved-places dead-end UX** (F2 + T19-11). Full list or a mistake is
   permanent; real users will hit this at 51 items or a typo.
5. **Neon-branch PITR unverified** (check 20). The runbook's recovery path is
   the untested one.
6. **Injection probes/battery stale** (checks 6/11–14). Live model never
   re-tested against prompt-injection chains after the fixes.
7. **No monthly LLM quota ledger** (check 15). A distributed free-tier burn is
   still survivable only per-IP; nothing counts total calls or warns at 70%.
8. **Data-quality drift in the new `data/ng` set** (T19-17). Duplicates +
   unresolved provenance ship downstream into recommendations (bad answers —
   real users see hallucinated-adjacent quality).
9. **Rate limit header confusion + live 429 shape unverified** (F4). Abuse
   defences may fire; humans can't parse intent; clients can't back off right.
10. **Docs drift (README badge 156→159 tests; dead "API down" status)** (F5).
    Newcomers' first impression is wrong in two directions.

### Quick wins (high impact, small effort)

- Status page / uptime check on `/health` + error tracking: hours.
- Rewrite `vercel.json`/`api/index.js` so `/api/v1/*` also live: small.
- README status + badge lines: minutes.
- Delete `data/` inconsistencies or wire `check:ng-data` as CI gate: small.
- Fix limiter header duplication (mount styles): small.
- saved-places DELETE endpoint + cap backstop (`INSERT … WHERE count < 50` or
  `FOR UPDATE` transaction): a focused afternoon.

Operational context for the original scoring below (was 2026-10-15/16, retained
for history; totals 61/75 = 81% as of 2026-10-16 captures pre-fresh state):



## Score table

| # | Check | Score | Evidence |
|---|---|---|---|
| 1 | BOLA ownership on every `:id` | 3 | EV-BOLA: B cannot list/delete A's favorite; B-delete-then-A-still-intact. `reset-nearby.test.js:149` |
| 2 | Unforgeable auth that expires | 3 | `tokens.js:5-6` (15m/7d), `store.js:109` revoke; tampered/forged/refresh-reuse all 401 (EV-BOLA-adjacent in break-it battery) |
| 3 | No mass assignment | 2 | zod strips unknown keys; `contract.test.js` v1/legacy parity. **Not** separately proven with a `role:'admin'` post → see gap G-4 |
| 4 | Bounded resource consumption | 3 | 10kb/350kb caps (413), per-endpoint 429 + Retry-After, LLM 10/min both mounts, MAX_STEPS=6, maxOutputTokens. `limits.test.js`, `limits-llm.test.js` |
| 5 | Function-level authz (API5) | 3 | `admin.routes.js:10` `requireAuth, requireAdmin`; break-it: non-admin `/admin/stats` → 403 |
| 6 | Sensitive-flow abuse gates (API6) | 2 | OTP cooldown + 5-attempt lockout + generic responses tested. **No live reset-bombing drill** → G-5 |
| 7 | No SSRF (API7) | 2 | Inventory: Overpass, Gemini, SMTP, Commons — none take a user-supplied URL. No `fetch(url-from-body)` found. **No negative test proving it** → G-6 |
| 8 | Secure defaults / no debug in prod (API8) | 3 | `env-guard` fail-closed boot; helmet + CSP at `app.js:32-49`; CORS fails closed when `CORS_ORIGIN` set |
| 9 | Route inventory (API9) | 3 | `ENDPOINTS` array `app.js:77-107` (27 routes); `errors.test.js:38-43` asserts list matches router |
| 10 | Upstream data validated (API10) | 3 | zod on LLM JSON; today's fix maps upstream failure → clean 502 (EV: chat upstream-failure drill, 8/8 502, 0×500) |
| 11 | Prompt injection tested (LLM01) | 2 | 4/5 probes pass (`agent-safety.mjs`); 5th inconclusive (circuit pre-open). Real bug found + fixed same day. **Only 5 probes, not a battery** → G-7 |
| 12 | No sensitive disclosure in model/logs (LLM02) | 2 | pino redaction + `xss.test.js` markup-chat stays JSON. **No redaction unit test asserting OTP/password absent from log lines** → G-8 |
| 13 | Least-privilege tools + human gates (LLM06) | 2 | 4 read-only/preference tools (`agent-tools.test.js`); no booking/message actions exist → no human gate needed yet |
| 14 | System prompt not leakable (LLM07) | 2 | Direct + indirect extraction attempts refused. Prompts live in `src/prompts/` by design; **leak is model-only, unconfirmed against a live model with adversarial tuning** → G-9 |
| 15 | Consumption capped (LLM10) | 2 | MAX_STEPS, token caps, per-IP limiter all present and tested. **No monthly call counter / 70% warning / quota-cap check in GCP** → G-10 |
| 16 | SLOs in percentiles (SRE Ch.4) | 2 | `docs/SLO.md` written 2026-10-16 (availability/latency/AI-success/error-rate + error budget). **Aggregation pipeline still missing** — p95 targets exist but nothing computes them automatically → G-3 |
| 17 | Graceful degradation on dependency failure (AWS REL) | 3 | DB-down drill (503 readiness + clean 500s + process survival); Gemini-down drill (8/8 clean 502, 0×500); recommend fallback deterministic |
| 18 | Disposability (12factor IX) | 2 | SIGTERM drain in `server.js`; serverless handler test (`serverless.test.js`). **No measured boot-to-healthy time** → G-11 |
| 19 | Timeout + backoff + breaker on Gemini | 3 | 20s timeout, exp backoff, breaker (5 fail / 60s cooldown) all unit-proven (`resilience.test.js`, 7 tests) |
| 20 | Backing services + PITR restore drill | 2 | Neon reachable, migrations applied; **logical restore drill PASS 2026-10-16** (pg_dump 36.5s → isolated DB → pg_restore 30.8s → counts identical → drop). **Neon-branch PITR restore still unverified** (needs Neon API key) |
| 21 | Config in env, never in code | 3 | `scan-secrets.mjs` clean (202 files); git-history scan for the Gemini key clean; `.env` gitignored |
| 22 | Logs as streams + request IDs + alerts | 1 | pino JSON + requestId proven. **Sentry absent, no uptime monitor, no alert rules → G-3** |
| 23 | Runbooks + blameless postmortems | 3 | `RUNBOOK.md` covers DB down / Gemini down / leaked secret / bad deploy / abuse spike; `POSTMORTEM_TEMPLATE.md` + one real postmortem (`POSTMORTEMS/2026-10-15-chat-500-instead-of-502.md`) written 2026-10-16 |
| 24 | CI gates block merges (DORA) | 2 | `ci.yml`: lint + build + `npm audit` + secret scan + Playwright E2E. **No Lighthouse job, no branch-protection proof** → G-13 |
| 25 | Dev/prod parity + migrations as code | 3 | Same SQL on pg-mem + Neon; migrations ordered + idempotent; `ON CONFLICT DO NOTHING` re-run proven |

**Total as of 2026-10-16 (historical): 61 / 75 = 81%** — superseded by the
2026-10-19 re-score (58/75 = 77%) above. Retained for movement tracking.

## Top 10 risks ranked by impact on real users

1. **No restore drill (check 20).** A botched migration or `DELETE` without
   `WHERE` is unrecoverable in practice. Fix: one real Neon restore into a temp
   branch, timings recorded.
2. **No `docs/SLO.md` (check 16).** Without a p95 target and error budget there
   is no way to say whether a regression matters.
3. **No Sentry / uptime monitor (check 22).** The live API is *currently dead*
   (`FUNCTION_INVOCATION_FAILED`) and nothing alerted — we found out by
   manual `curl`. That is the exact failure this check exists to prevent.
4. **Agent-safety probes are 5, not a battery (check 11).** One probe was
   inconclusive because the circuit was pre-open; a real attacker would chain
   injection + tool calls.
5. **No monthly LLM quota counter (check 15).** Per-IP limits do not stop a
   distributed quota burn that empties the free tier in a day.
6. **No postmortem for the 500-vs-502 bug (check 23).** The bug class (upstream
   failure surfacing as 500) will recur in the next service wrapper.
7. **No `role:'admin'` mass-assignment test (check 3).** zod should strip it;
   nothing proves it does.
8. **No SSRF negative test (check 7).** The inventory is clean today; a future
   "fetch this URL" feature could land unnoticed.
9. **No Lighthouse in CI (check 24).** Accessibility and PWA regressions ship
   silently.
10. **No boot-to-healthy measurement (check 18).** Slow boots on Neon cold
   start are invisible until a deploy races a health check.

## Gaps (each maps to a check)

| Gap | Check | What's missing | Status (2026-10-16) |
|---|---|---|---|
| G-1 | 16 | `docs/SLO.md` + measured p95 from a load test | **closed** — `SLO.md` written; ramp recorded in `EVIDENCE.md` (local, not representative) |
| G-2 | 20 | Real Neon restore drill into a temp branch | **partial** — logical restore into an isolated DB passed (36s/31s, counts verified); Neon *branch* still needs the API key |
| G-3 | 22 | Sentry DSN, uptime check on `/health`, alert rules | open — no tooling configured |
| G-4 | 3 | Test: POST `role:'admin'` is ignored | open |
| G-5 | 6 | Live reset-bombing drill (respect rate limits) | open |
| G-6 | 7 | Negative SSRF test (user input never becomes a URL) | open |
| G-7 | 11 | Full injection battery (chained tool calls, not just 5 probes) | open |
| G-8 | 12 | Redaction unit test (OTP/password absent from log lines) | open |
| G-9 | 14 | Adversarial system-prompt extraction vs a live model | open |
| G-10 | 15 | Monthly call counter + 70% warning + GCP quota cap | open |
| G-11 | 18 | Measured boot-to-healthy time | open |
| G-12 | 23 | Blameless postmortem for the 500-vs-502 bug | **closed** — `POSTMORTEMS/2026-10-15-chat-500-instead-of-502.md` |
| G-13 | 24 | Lighthouse CI job + branch-protection proof | open |

Design documents (Phase 2) are complete: `SLO.md`, `THREAT_MODEL.md`, `POSTMORTEM_TEMPLATE.md`, seven ADRs in `docs/adr/`.

## Product / screen completeness (checked 2026-10-15)

`src/screens/Soon.jsx` ("This section is being plated") exists but is **dead
code** — `src/app/router.jsx` imports `HomeScreen`, `AuthScreen`,
`MapScreen`, `PlanScreen`, `HistoryScreen`, `SettingsScreen`, `AdminScreen`,
and `ErrorScreens` only. No route renders a placeholder. The 27-route
inventory in `app.js:77-107` has no `Soon` entry. If a placeholder screen was
expected in the product surface, it is not currently reachable; if it was
removed, the file should be deleted rather than left to rot.

## Unverified (could not confirm)

- **Live Vercel API.** Landing and `/app` return 200; the API function is
  `FUNCTION_INVOCATION_FAILED` because the 5 required env vars are not set in
  the Vercel project. All live-header, prod-CORS, and prod-`TRUST_PROXY`
  claims are therefore unverified against a real origin.
- **SMTP delivery.** Only template unit tests exist; no App Password supplied.
- **Neon free-plan quotas.** Storage/CU-hour caps differ across docs
  generations; must be read from the project dashboard during the restore
  drill.
- **Playwright browsers locally.** CI installs Chromium; local runs need
  `PW_CHANNEL=msedge`.
- **k6.** Not installed; local load ramp used autocannon and is labelled
  "local, not representative" in `EVIDENCE.md`.
