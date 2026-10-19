# Maturity — before/after this review

> Re-scored **2026-10-19 (agent-assessed)**. The 61/75 (81%) reading of
> 2026-10-16 was produced by the building agent and is **superseded by a
> fresh-evidence-only re-score: 58/75 = 77%** — see `AUDIT.md` (re-score table)
> for why three rows dropped. Bias disclosure and recommendation for an
> independent reviewer live at the top of `AUDIT.md`. Level **L2 boundary
> (not crossing)**: live basics + CI gates + drills exist, but no monitoring
> (L2 gate requirement), canonical contract is broken for external clients,
> and PITR stays unverified.

## Score movement

| Snapshot | Score | % | What moved it |
|---|---|---|---|
| 2026-10-15 baseline | 58 | 77% | — |
| 2026-10-16 restore/SLO/postmortem pass (builder-scored) | 61 | 81% | checks 16, 20, 23 |
| **2026-10-19 fresh re-score (agent-assessed)** | **58** | **77%** | −1 each: bounded-consumption (cap race), route-inventory-truth (canonical 404 live), dev/prod-parity (same root cause). Offsetting gains (live boot, CORS allowlist live, SW fix proven live, 159 tests green) did **not** add points because they close risks, not the checks that measure them |

What improved in substance (risk-wise), even where the score is flat: the
system is **actually serving users now** (health, auth, saved-places, one AI
call all verified live — `EVIDENCE.md` T19-01/02/07/08); the service-worker
offline bug is proven fixed against the deployed bundle (T19-14); CORS is
fail-closed on the live origin (T19-05); anonymous LLM burn is blocked (T19-06).

Areas that were **fixed with proof** during the review, not just scored:

- Chat upstream failures: 500 → clean 502 (`fffac18`, drill 8/8, regression test).
- LLM resilience: 20 s timeout, backoff, circuit breaker, deterministic
  recommend fallback (`8931770`, 8 tests).
- Access tokens out of localStorage; strict CSP (`4187c56`, header scan + 2 tests).
- Break-it battery: 14/14 attacks (`scripts/break-it.mjs`).
- Agent-safety probes: 4/5 contained (`scripts/agent-safety.mjs`).
- Neon restore drill: PASS, counts identical (`EVIDENCE.md` 2026-10-16).
- Runtime data files untracked from git (`fce26e8`).

## Evidence index

| Claim | Evidence |
|---|---|
| **Live `/health` + `/health/ready` 200, DB up (2026-10-19)** | `EVIDENCE.md` T19-01 |
| **Live signup/signin/cookie/CORS/headers (2026-10-19)** | T19-02, T19-05 |
| **saved-places live: scoped, hostile-input tests, race (2026-10-19)** | T19-08…T19-13 |
| **Live AI call grounded + traced (2026-10-19, 1 call)** | T19-07 |
| **SW offline fix proven on deployed bundle (2026-10-19)** | T19-14 |
| 159/159 tests, lint clean, build green, secrets clean (2026-10-19) | T19-16 |
| Restore drill (logical) PASS | `EVIDENCE.md` "Neon restore drill (2026-10-16)" |
| 502 mapping proven (drill) | `EVIDENCE.md` "Chat upstream-failure drill" |
| Load numbers (local only, NOT representative) | `EVIDENCE.md` "Load ramp" |

## Top 5 remaining risks (re-ranked 2026-10-19; full list AUDIT.md)

1. **No monitoring/error tracking on a now-live system.** The outage risk
   flipped from "everybody sees it" to "nobody knows" — worse with real users.
2. **Canonical `/api/v1/*` contract 404s live** — any external client or
   monitor built on the documented API fails silently.
3. **No SLO measurement/alerting machinery** — targets in docs, nothing runs.
4. **saved-places is a dead-end surface** — no delete/edit; the 50-cap is
   exceedable by burst (defence missing) and permanent once legitimately full.
5. **Neon-branch PITR unverified** — runbook recovery path untested, needs
   Neon API key.

## What this system IS ready for (2026-10-19)

- **Serving real users as a demo/early-access product**: API is live and
  verified end-to-end from a fresh account (signup → signin → saved-places →
  one AI recommendation), with degradation drills recorded, rate limits
  acting, and CORS fail-closed. "Not ready" below is what bars the *next*
  step, not the current one.
- Surviving its claimed failure modes: DB down, Gemini down, oversized input,
  auth abuse, BOLA — drilled.
- Being extended by another engineer: 25-check standards, STRIDE threat
  model, SLOs, 7 ADRs, postmortem template, evidence ledger current as of today.

## What this system is NOT ready for

- **Being trusted as production-grade infrastructure** (label, not usage):
  risk 1 (zero monitoring) means the first outage repeats silently; the
  documented API contract doesn't work live (risk 2) breaks any external
  integration or uptime posture.
- **Documented public API promises.** Publishing `API.md`'s `/api/v1/*` paths
  to a third party today means that client 404s. Contract drift first.
- **Any promise about scale.** No load numbers from the deployed environment.
- **Compliance or privacy claims.** No privacy policy page, no consent text,
  NDPA posture is delete-endpoint-only (and delete-account exists but the saved-
  places cascade is schema-level `ON DELETE CASCADE`, untested live).
- **Autonomous agent actions.** Tools are read-only; any future write tool
  needs human-approval gates absent today (THREAT_MODEL E3).

## What a distinguished reviewer would still criticise (2026-10-19)

- The 2026-10-16 81% was scored by the building agent; today's 77% fixes that
  accounting but is **still agent-assessed** — an independent re-score is the
  missing credibility step.
- Four live probes ≠ a battery: auth abuse, chained prompt injection, and the
  reset flow were not re-run against the live model/DB today; today's evidence
  is depth on one new surface (`saved-places`) and breadth on the gates.
- The agent-safety battery is five probes against a pre-broken circuit — a
  chained injection+tool attack has never been run end-to-end against a live
  model.
- Load testing never touched the deployed system; the `max: 3` pool question
  matters more now that real traffic exists, and remains inferred only.
- CI is green but branch protection has never been verified — "gates block
  merges" is a claim, not a proof.
- The e2e suite covers one path (signup→nearby→save→signout); recommendation,
  chat, and admin flows have no browser-level coverage.
- `data/ng` (new, untracked) ships 17 duplicate keys and 40 unresolved
  source_refs with a checker that exits 0 — provenance is drifting silently.
