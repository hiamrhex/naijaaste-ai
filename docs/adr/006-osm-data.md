# ADR 006 — OpenStreetMap catalogue + curated seed

- Status: accepted. Date: 2026-10-11.
- Context: 60 hand-curated rows can't cover 8 cities; Google Places needs a billed card.

## Options considered

1. **OSM Overpass + curated seed (chosen)** — free, no key; nightly import with dedupe, `last_seen`, quality flags; curated rows carry full objects in `meta`.
2. Google Places — richer data, but requires billing + API key + per-call spend; rejected on budget constraint.
3. Curated-only — highest quality, but frozen at 60 and stale by design.

## Decision

`restaurants` holds both: `code`-keyed curated rows (`verified:true`) and `osm_id`-keyed imports. Readers query Postgres with city/box/code pushdowns; `restaurants.json` is seed fixture only.

## Why

- Free tier compatible; ODbL attribution honored (landing, README, API responses).
- Coverage grows daily without hand curation.

## Consequences

- Good: zero data spend; honest provenance per row.
- Bad: sparse Nigerian OSM coverage; unverified listings must be flagged in UI eventually.
- Wrong if: listing quality (not coverage) becomes the complaint — then pay for Places or fund curation.
