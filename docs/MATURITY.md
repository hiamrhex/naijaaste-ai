# Maturity — before/after this review

> Written 2026-10-16. Phase 7 of the review program. Sources: `docs/AUDIT.md`
> (25-check scores), `docs/EVIDENCE.md` (command outputs), CI runs on
> `hiamrhex/naijaaste-ai`.

## Score movement (AUDIT.md, 0–3 scale, max 75)

| Snapshot | Score | % | What moved it |
|---|---|---|---|
| Before review (2026-10-15 baseline) | 58 | 77% | — |
| After restore drill + SLO + threat model + postmortem (2026-10-16) | 61 | 81% | check 16 (1→2), check 20 (1→2), check 23 (2→3) |

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
| 156/156 tests, lint clean, build green | `EVIDENCE.md` + CI on `fffac18` (success) |
| Secret scan clean, history clean | `scan-secrets.mjs` output, `EVIDENCE.md` |
| Restore drill PASS | `EVIDENCE.md` "Neon restore drill (2026-10-16)" |
| 502 mapping proven live | `EVIDENCE.md` "Chat upstream-failure drill" |
| Load numbers (local only) | `EVIDENCE.md` "Load ramp — local, NOT representative" |

## Top 5 remaining risks (ranked by user impact)

1. **Live API is down.** Vercel function `FUNCTION_INVOCATION_FAILED` — five
   env vars not set in the project. Everything real-user-facing except the
   static landing page is dark. Fix: set vars (needs Vercel access) and
   re-run the live smoke + header scan.
2. **No SLO enforcement machinery.** `SLO.md` defines targets; nothing
   computes p95s or alerts on burn. Without it the SLOs are documentation.
3. **No error tracking or uptime monitor.** The live outage in risk 1 was
   found by manual curl, not by an alert.
4. **Pool `max: 3` versus concurrency.** Measured: nearby collapses to 1 rps
   at 200 concurrent callers from a high-latency network. On same-region
   Vercel it will be better but the pool sizing has never been measured
   against Neon's real connection cap.
5. **Neon-branch PITR unverified.** Logical restore into a side database
   passed; the branch-restore path the runbook depends on has never been
   exercised (needs Neon API key).

## What this system IS ready for

- Demoing to users with a working Gemini key: the full local path (auth →
  nearby → chat → recommend → favorites) is green under test, and degradation
  behaviour when Gemini is down is proven, not assumed.
- Surviving the failure modes it claims in the runbook: DB down, Gemini down,
  oversized/malformed input, auth abuse, BOLA — each has a recorded drill.
- Being extended by another engineer: 25-check standards, STRIDE threat
  model, SLOs, ADRs, postmortem template, and an evidence ledger exist and
  are current.

## What this system is NOT ready for

- **Production traffic.** Risk 1 is disqualifying until the API boots on
  Vercel; risks 2–3 mean an outage would be silent even after it boots.
- **Any promise about scale.** The only load numbers are from one laptop to a
  remote database over the public internet, explicitly not representative.
- **Compliance or privacy claims.** No privacy policy page, no consent text,
  NDPA posture is delete-endpoint-only.
- **Autonomous agent actions.** Tool surface is read-only by construction;
  any future write/action tool needs human-approval gates that do not exist
  yet (THREAT_MODEL.md E3).

## What a distinguished reviewer would still criticise

- The 81% is gamed by scoring documentation artefacts; three of the four
  highest-user-impact risks are unmeasured or unmonitored, not undocumented.
- The agent-safety battery is five probes against a pre-broken circuit — a
  chained injection+tool attack has never been run end-to-end against a live
  model.
- Load testing never touched the deployed system; the pool-size question is
  inferred, not measured, in the region that matters.
- CI is green but branch protection has never been verified — "gates block
  merges" is a claim, not a proof.
- The e2e suite covers one path (signup→nearby→save→signout); recommendation,
  chat, and admin flows have no browser-level coverage.
