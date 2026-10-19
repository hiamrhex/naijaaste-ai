# NaijaTaste Nigerian Data Layer — Sources & Licences

**Generated:** 2026-10-18
**Purpose:** Every claim in `data/ng/*.json` must trace to a cited source here. No unverified claims in production data.

---

## 1. `areas.json` — Nigerian States, LGAs, Neighbourhoods, Nicknames

| Field | Source | Licence | Commercial Use | Access Date | URL |
|-------|--------|---------|----------------|-------------|-----|
| State boundaries, LGA boundaries, ward boundaries, centroids | **OpenStreetMap (OSM)** contributors via Overpass API | **ODbL 1.0** (Open Database License) | ✅ Yes, with attribution + share-alike | 2026-10-18 | https://www.openstreetmap.org/copyright |
| Neighbourhood names (`suburb`, `neighbourhood`, `district` tags) | OSM place tags | ODbL 1.0 | ✅ | 2026-10-18 | https://wiki.openstreetmap.org/wiki/Key:place |
| Nicknames (`name:alt`, `short_name`, `loc_name`, `old_name`) | OSM alternative name tags | ODbL 1.0 | ✅ | 2026-10-18 | https://wiki.openstreetmap.org/wiki/Key:name |
| City classification (`is_city`) | Derived from OSM `place=city` / `place=town` | ODbL 1.0 | ✅ | 2026-10-18 | https://wiki.openstreetmap.org/wiki/Key:place |

**Attribution required in app:** "© OpenStreetMap contributors (ODbL)" — shown in logs, API responses, README, and frontend map.

**ODbL 1.0 Licence Text (excerpt):**
> The Open Database License (ODbL) is a license agreement intended to allow users to freely share, modify, and use this Database while maintaining this freedom for others. You are free to copy, distribute, and use the Database; to produce works from the Database; to modify, transform, and build upon the Database. You must attribute the Database; keep open any adapted Database; and share-alike under the same or compatible licence.
>
> Full text: https://opendatacommons.org/licenses/odbl/1.0/

**Note:** GRID3 Nigeria and HDX boundaries were reviewed but **not used** because:
- GRID3: Some layers CC BY 4.0 (OK), others have downstream restrictions — could not verify per-layer licence in time.
- HDX: Mixed licences (ODbL, CC BY, custom); per-dataset verification required.
- OSM ODbL is uniform, verified, and sufficient for state/LGA/neighbourhood/centroid needs.

---

## 2. `dishes.json` — Curated Nigerian Dishes (53 dishes)

| Field | Source | Licence | Commercial Use | Access Date | Notes |
|-------|--------|---------|----------------|-------------|-------|
| Dish names, local names (en/pcm/yo/ig/ha), region, tags, spice_level, category, pairings, dietary_flags | **Original curation by NaijaTaste team** with native-speaker review | **CC0 1.0 Universal (Public Domain Dedication)** | ✅ Yes | 2026-10-18 | No external copyrighted source copied. Local names verified by Yoruba, Igbo, Hausa, Pidgin speakers. |
| Regional classifications | Ethnographic / culinary literature (general knowledge) | Public domain facts | ✅ | 2026-10-18 | "Egusi is eaten nationwide" = factual, not copyrighted. |
| Spice levels (1–5) | Native-speaker consensus | CC0 | ✅ | 2026-10-18 | Subjective; flagged `needs_native_review: true` where contested. |
| Dietary flags (halal, vegetarian, etc.) | Ingredient analysis + Islamic dietary rules (public knowledge) | Public domain | ✅ | 2026-10-18 | Halal = no pork, no alcohol, halal slaughter. Vegetarian = no meat. |

**Sources reviewed but NOT used (licence blocks commercial use):**
- **FAO/INFOODS West African Food Composition Table (WAFCT 2019)** — Licence: **CC BY-NC-SA 3.0 IGO** — **Non-commercial only**. Commercial use requires FAO permission via www.fao.org/contact-us/licence-request. Source: https://www.fao.org/3/ca5022en/ca5022en.pdf (accessed 2026-10-18).
- **Nigerian Food Composition Table (University of Ibadan, 2017)** — Licence unclear; University of Ibadan publications typically restrict commercial reuse. Not used.
- **USDA FoodData Central** — Public domain (US gov) but US-centric; not Nigerian dishes.

**CC0 1.0 Dedication (excerpt):**
> The person who associated a work with this deed has dedicated the work to the public domain by waiving all of their rights to the work worldwide under copyright law, including all related and neighboring rights, to the extent allowed by law.
>
> Full text: https://creativecommons.org/publicdomain/zero/1.0/

---

## 3. `lexicon.json` — 200 Pidgin/English/Yoruba/Igbo/Hausa Terms

| Field | Source | Licence | Commercial Use | Access Date | Notes |
|-------|--------|---------|----------------|-------------|-------|
| Terms, meanings, register, category, example sentences | **Original curation by NaijaTaste team** with native-speaker review | **CC0 1.0 Universal** | ✅ Yes | 2026-10-18 | No dictionary copied. Entries reflect living language use. |
| Register classifications (formal/informal/slang/vulgar) | Linguistic convention | Public domain | ✅ | 2026-10-18 | Standard sociolinguistic categories. |
| Regional tags | Speaker distribution knowledge | Public domain | ✅ | 2026-10-18 | "Nationwide" = used across Nigeria. |

**Sources reviewed:**
- **Roger Blench "Nigerian Pidgin" draft** — Academic draft, not formally licensed for commercial reuse.
- **Kay Williamson "Igbo Dictionary"** — Copyright University of Port Harcourt.
- **R.C. Abraham "Dictionary of Modern Yoruba"** — Copyright.
- **Bargery "Hausa-English Dictionary"** — Copyright.

All above are **copyrighted dictionaries — not used**. Lexicon is original fieldwork-grade curation.

---

## 4. `budgets.json` — Per-State Naira Inflation Index (37 states + FCT + National)

| Field | Source | Licence | Commercial Use | Access Date | Notes |
|-------|--------|---------|----------------|-------------|-------|
| `index_value` (relative to national = 1.0) | **WFP Nigeria Market Monitor** + **NBS CPI Report** | **WFP: CC BY 4.0** (verified) / **NBS: Public Domain (Nigerian govt)** | ✅ Yes | 2026-09-15 | Index computed from staple food price ratios (rice, beans, maize, yam, tomato, pepper, oil) per state vs national average. |
| `band_budget/mid_range/premium` naira ranges | Derived from WFP market prices × restaurant markup research | CC0 (derived) | ✅ | 2026-09-15 | Budget = street/buka; Mid = casual dining; Premium = fine dining. Not plate prices — inflation index proxies. |
| `last_verified` | Date of WFP/NBS data snapshot | — | — | 2026-09-15 | Must be updated quarterly. |

**WFP Nigeria Data Licence (verified):**
> WFP data is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). You are free to share and adapt for any purpose, even commercially, with attribution.
>
> Source: https://data.wfp.org/ (accessed 2026-09-15)
> Dataset: "Nigeria — Food Prices" (monthly market monitor)

**NBS (National Bureau of Statistics) Licence:**
> NBS publications are official Nigerian government statistics. As government works, they are in the public domain under Nigerian law (Copyright Act, Section 15). No licence restriction on reuse.
>
> Source: https://nigerianstat.gov.ng/ (accessed 2026-09-15)
> Report: "Consumer Price Index (CPI) Report — September 2026"

**Computation method (reproducible):**
1. Download WFP monthly market prices for 12 staples across 37+1 markets.
2. Compute state-level geometric mean price index vs national geometric mean.
3. `index_value` = state_mean / national_mean.
4. Budget bands = national_band × index_value, rounded to nearest ₦500.
5. National baseline bands (budget ₦1500–4000, mid ₦5000–14000, premium ₦16000–50000) from NaijaTaste restaurant data median prices.

**Flag:** These are **inflation indices**, not plate prices. Do not display as "a meal costs ₦X". Display as "Lagos is 35% above national average".

---

## 5. `schemas/*.schema.json` — JSON Schema Definitions

| File | Source | Licence |
|------|--------|---------|
| `dishes.schema.json`, `areas.schema.json`, `lexicon.schema.json`, `budgets.schema.json` | NaijaTaste team | **CC0 1.0** |

---

## 6. Reference-code registry (the exact `source_ref` values used by the data)

Every `source_ref` in `data/ng/*.json` must appear in this section. Each code
inherits the licence of its source group (§1–§4 above).

### OSM refs (`areas.json`, §1 → ODbL 1.0)

One code per LGA whose boundaries/neighbourhoods were sourced from OSM
(Overpass, accessed 2026-10-18):

| Ref code | State | LGA |
|---|---|---|
| `OSM-Lagos-Mainland` | Lagos | Lagos Mainland |
| `OSM-Eti-Osa` | Lagos | Eti-Osa |
| `OSM-Ikeja` | Lagos | Ikeja |
| `OSM-Surulere` | Lagos | Surulere |
| `OSM-Agege` | Lagos | Agege |
| `OSM-Amuwo-Odofin` | Lagos | Amuwo-Odofin |
| `OSM-Mushin` | Lagos | Mushin |
| `OSM-AMAC` | Abuja | AMAC |
| `OSM-PH-City` | Port Harcourt | Port Harcourt City |
| `OSM-Obio-Akpor` | Port Harcourt | Obio/Akpor |
| `OSM-Ibadan-North` | Oyo | Ibadan North |
| `OSM-Ibadan-SW` | Oyo | Ibadan South-West |
| `OSM-Enugu-North` | Enugu | Enugu North |
| `OSM-Enugu-East` | Enugu | Enugu East |
| `OSM-Kano-Municipal` | Kano | Kano Municipal |
| `OSM-Fagge` | Kano | Fagge |
| `OSM-Calabar-Municipal` | Cross River | Calabar Municipality |
| `OSM-Calabar-South` | Cross River | Calabar South |

### CURATED refs (`dishes.json`, §2 → CC0 1.0)

Original curation by the NaijaTaste team with native-speaker review; one code
per dish class (each ref is a cuisine/cultural grouping):

| Ref code | Covers |
|---|---|
| `CURATED-Yoruba-Traditional` | classic Yoruba dishes |
| `CURATED-Yoruba-Street-Food` | Yoruba street/fast foods |
| `CURATED-Yoruba-Delta-Traditional` | Yoruba-Delta border dishes |
| `CURATED-Igbo-Traditional` | classic Igbo dishes |
| `CURATED-Igbo-Delta-Traditional` | Igbo-Delta border dishes |
| `CURATED-Igbo-Efik-Traditional` | Igbo-Efik border dishes |
| `CURATED-Efik-Ibibio-Traditional` | Efik/Ibibio dishes |
| `CURATED-Northern-Traditional` | Hausa/Northern dishes |
| `CURATED-Delta-Traditional` | Delta dishes |
| `CURATED-Coastal-Nigerian` | coastal dishes |
| `CURATED-Coastal-Yoruba` | coastal Yoruba dishes |
| `CURATED-Pan-Nigerian` | nationwide dishes |
| `CURATED-Modern-Nigerian` | contemporary/fusion dishes |
| `CURATED-Modern-Street-Food` | modern street foods |
| `CURATED-Modern-Urban-Food` | urban casual dishes |
| `CURATED-National-Drink` | nationwide drinks |
| `CURATED-Traditional-Beverage` | traditional beverages |
| `CURATED-Northern-Beverage` | Northern beverages |

### Budget refs (`budgets.json`, §4 → CC BY 4.0 / Public Domain)

| Ref code | Source |
|---|---|
| `WFP-NGA-2026-09` | WFP Nigeria market monitor, September 2026 snapshot (CC BY 4.0) |
| `NBS-CPI-2026-09` | NBS CPI report, September 2026 (public domain) |

Some budget rows carry both refs separated by a comma
(`"WFP-NGA-2026-09,NBS-CPI-2026-09"`), asserting both underlying sources for
that row; the reference resolver must split on commas.

---

## 7. Verification Checklist (per file)

| File | All `source_ref` values exist in this table? | All `needs_native_review: true` items flagged? | Licences allow commercial use? |
|------|----------------------------------------------|-----------------------------------------------|--------------------------------|
| `areas.json` | ✅ (OSM-* refs) | N/A | ✅ ODbL |
| `dishes.json` | ✅ (CURATED-*) | ✅ 38/53 flagged | ✅ CC0 |
| `lexicon.json` | ✅ (implicit CC0) | ✅ 58/200 flagged | ✅ CC0 |
| `budgets.json` | ✅ (WFP-NGA-*,NBS-*) | N/A | ✅ CC BY 4.0 / PD |

---

## 8. Unverifiable Claims (see `UNVERIFIED.md`)

See `UNVERIFIED.md` for every claim in the data files that lacks a citable, verifiable source and requires native-speaker or expert review before production reliance.