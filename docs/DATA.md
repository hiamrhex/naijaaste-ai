# Data

> Last verified: 2026-10-14.

## Sources

| Source | What | Freshness | Provenance |
|---|---|---|---|
| Hand-curated seed | 60 restaurants, 8 cities, full fields (dishes, prices, spice, dietary) | Frozen at seed; `verified:true` | `src/data/restaurants.json` → `npm run db:migrate` |
| OpenStreetMap (Overpass) | Lagos, Abuja, Port Harcourt, Ibadan; name/coords/cuisine/hours/address | Daily via `.github/workflows/refresh.yml` (manual trigger included) | `osm_id`, `source:'osm'`, `last_seen`, `verified:false` |

## Pipeline

`src/data/import-osm.js` (polite: `NaijaTasteAI` User-Agent, ~1.5s gaps, 2 mirrors) →
`normalizeOsmElement` (drops nameless, never invents ratings/prices) →
`upsertRestaurants` (match on `osm_id`, then fuzzy name+city dedupe) →
Postgres. Readers use city/box/code pushdowns (`src/db/catalogue.js`).

Licence: Restaurant data © OpenStreetMap contributors (ODbL) — attribution on
landing page, README, and API responses.

## Known quality issues (honest)

- OSM coverage outside Lagos is sparse; many listings lack hours/phone.
- OSM rows carry conservative defaults (`mid`, `casual`, `medium`) — real values unknown until verified.
- `markStale` flags rows unseen >90 days, but nothing surfaces `stale` in the UI yet.
- Ratings are stored but not consumed by ranking (queued loop).
- Overpass is unreachable from some networks (this machine included) — mirrors + cron cover it; curated seed guarantees baseline coverage.
