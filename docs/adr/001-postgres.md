# ADR 001 — Neon Postgres as the single runtime store

- Status: accepted. Date: 2026-10-11.
- Context: runtime state lived in JSON files + in-memory OTP (single-process, lost on restart, no good on serverless).

## Options considered

1. **Neon Postgres (chosen)** — free tier, no card; pooled URL for runtime, direct URL for migrations.
2. Prisma/Drizzle ORM — nicer DX, but a new abstraction over simple SQL; rejected as overkill for ~15 queries.
3. Keep JSON + sticky single host — cheapest, but kills Vercel deploy and multi-instance forever.

## Decision

All runtime state (users, refresh JTIs, favorites, OTPs, sessions, ratings, reports, catalogue) in Postgres, via one SQL surface shared by two drivers: real `pg` when `DATABASE_URL` is set, `pg-mem` otherwise (tests, keyless dev).

## Why

- Tests execute production SQL (caught a real `NOT NULL` seed bug and a pg-mem `ANY()` gap before prod).
- Fail-closed boot in production without `DATABASE_URL` — no silent ephemeral mode.

## Consequences

- Good: deployable serverless; honest durability story; 6h PITR on free tier.
- Bad: SQL must stay portable (no extensions/CITEXT/arrays) for pg-mem parity.
- Risk: pg-mem divergence on exotic syntax — mitigated by the dynamic-`IN` rule.
- Wrong if: query load outgrows Neon free (watch CU-hours + storage); revisit at sustained >50% quota.
