# ADR 007 — pg-mem for tests (same SQL, ephemeral DB)

- Status: accepted. Date: 2026-10-11.
- Context: CI has no network/DB; tests must still prove production queries.

## Options considered

1. **pg-mem, same SQL (chosen)** — in-process Postgres emulation; migrations + seed run per test file.
2. Dockerized Postgres in CI — faithful, but heavy runners, flaky networking, slower feedback.
3. Mocks/fakes per store — fast, but proves nothing about SQL (would have missed the real `NOT NULL` seed bug).

## Decision

`getPool()` returns real `pg` with `DATABASE_URL`, else pg-mem (devDependency, dynamic import so `--omit=dev` builds never touch it). SQL stays portable: no extensions, CITEXT, arrays; dynamic `IN (...)` lists instead of `= ANY($1)` (pg-mem gap, proven by a failing test).

## Why

- Caught two real bugs pre-prod (seed nullability, ANY incompatibility).
- 19-suite suite runs in ~20s with zero infra.

## Consequences

- Good: fast, hermetic, no Docker.
- Bad: per-file init cost (mitigated: batched seed INSERT, 60s hook budget); exotic SQL forbidden.
- Wrong if: Postgres-specific features (extensions, advisory locks) are ever needed — then add a Docker-backed suite.
