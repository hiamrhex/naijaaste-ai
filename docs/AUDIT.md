# Baseline Audit — scored against `docs/STANDARDS.md`

Scored 2026-10-15. Scale: **0** missing, **1** partial, **2** works, **3**
works and proven with command output or a test. Every non-zero score cites an
evidence ID (`EV-NNN` → entry in `docs/EVIDENCE.md`) or a file:line.

**Verdict (updated 2026-10-16): 81% — see total below; three gaps remain open
that a reviewer would call launch-blocking (SLO measurement, live API health,
Neon-branch PITR).** No area scores 0.

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

**Total: 61 / 75 = 81%** (was 58/75 = 77% on 2026-10-15; G-1, G-2 partial,
G-12 closed on 2026-10-16). This crosses the 80% line, but the label that
goes with it is **earned only in the letter of the checklist** — the SLO
measurement pipeline (G-3), the live API (Vercel env vars), and the
Neon-branch PITR drill are all still open, and a distinguished reviewer would
flag the 81% as fragile until they close.

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
