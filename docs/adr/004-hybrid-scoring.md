# ADR 004 — Hybrid scoring: deterministic pre-score + LLM narrative

- Status: accepted. Date: 2026-10-11 (service predates; recorded here).
- Context: recommendations must be relevant, explainable, cheap, and alive when the LLM is down.

## Options considered

1. **Hybrid (chosen)** — hard filters (city/dietary) → weighted pre-score (budget .30, ambience .25, spice .20, value .15, social .10) → top-15 to LLM for ranking + narrative.
2. Pure LLM ranking — better prose, but no graceful degradation, higher token spend, untestable ordering.
3. Pure deterministic — testable and free, but flat explanations, no persuasion.

## Decision

Deterministic pipeline picks candidates; the LLM writes ordering + reasons over at most 15 candidates.

## Why

- City/box pushdowns keep it fast at 100k rows; LLM sees bounded context.
- LLM outage → still have scored candidates (fallback path exists in service).

## Consequences

- Good: testable scoring weights; capped token cost per recommend.
- Bad: two ranking logics to keep consistent; weights are heuristics, not learned.
- Wrong if: per-user rating history should drive ranking — that's the queued ratings→recommendations loop (needs eval harness proof first).
