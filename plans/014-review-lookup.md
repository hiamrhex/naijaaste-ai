# Plan 014: Look up review restaurants by id before falling back to name search

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 80e106e..HEAD -- src/agent/tools.js tests/agent-tools.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `80e106e`, 2026-10-12

## Why this matters

The agent's `generate_review` tool indexes the restaurant array with a string id (`restaurants['r001']`), which is always `undefined` — so every review request carrying a real `restaurant_id` misses and falls into a name-fuzzy fallback that returns `Restaurant "r001" not found`. A flagship feature fails on its primary input shape. After this plan, id lookup works and name search remains as fallback.

## Current state

- `src/agent/tools.js:101-109` (verified at 80e106e):
```js
case 'generate_review': {
  const restaurant = restaurants[args.restaurant_id];
  if (!restaurant) {
    const found = Object.values(restaurants).find(r => r.name?.toLowerCase().includes((args.restaurant_id || '').toLowerCase()));
    if (!found) return { error: `Restaurant "${args.restaurant_id}" not found` };
    return await generateReview(args.persona || session.extracted_persona, found);
  }
  return await generateReview(args.persona || session.extracted_persona, restaurant);
}
```
- `restaurants` is an Array (module scope, `JSON.parse(readFileSync(...restaurants.json))`; `src/routes/auth.routes.js:17` maps over it as an array).
- `executeTool` is exported (`src/agent/tools.js:126`: `export { executeTool };`) — unit-testable without the agent loop.
- `generateReview` (from `src/services/review.service.js`) calls the LLM — the new tests must NOT reach it (no network in unit tests).
- Repo conventions: vitest; existing suites in `tests/`; `npm test`, `npm run lint`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| New tests | `npx vitest run tests/agent-tools.test.js` | all pass |
| Full suite | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/agent/tools.js` (lookup only — extract helper + use it in `generate_review`)
- `tests/agent-tools.test.js` (new)

**Out of scope**:
- `generateReview`, review prompts/scoring, any other tool.
- Catalogue loading changes (dedicated perf concern, separate plan).

## Git workflow

- Branch: `advisor/014-review-lookup`
- Commit message style: conventional — e.g. `fix: look up review restaurants by id before name fallback`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Extract an exported id-first finder and use it

In `src/agent/tools.js`, add near the top (after the catalogue load):
```js
export const findRestaurantByIdOrName = (idOrName) => {
  if (!idOrName || typeof idOrName !== 'string') return undefined;
  const byId = restaurants.find((r) => r.restaurant_id === idOrName);
  if (byId) return byId;
  const needle = idOrName.toLowerCase();
  return restaurants.find((r) => r.name?.toLowerCase().includes(needle));
};
```
Rewrite the `generate_review` case to:
```js
case 'generate_review': {
  const restaurant = findRestaurantByIdOrName(args.restaurant_id);
  if (!restaurant) return { error: `Restaurant "${args.restaurant_id}" not found` };
  return await generateReview(args.persona || session.extracted_persona, restaurant);
}
```
Behavior for name inputs is preserved (same `includes` fallback); id inputs now hit.

**Verify**: `grep -n "restaurants\[args.restaurant_id\]" src/agent/tools.js` → no match; `grep -n "findRestaurantByIdOrName" src/agent/tools.js` → 2 matches (definition + use).

### Step 2: Add unit tests that never touch the LLM

Create `tests/agent-tools.test.js` importing `findRestaurantByIdOrName` from `../src/agent/tools.js` (pure lookup — no LLM, no network):
1. Known id from the real catalogue (read one `restaurant_id` via the same JSON file in the test, e.g. filter `r.restaurant_id` — assert the found object's `restaurant_id` equals the input). To stay robust to catalogue edits, derive the id from the file at test time rather than hardcoding.
2. Unknown id (`'no-such-place-xyz'`) → `undefined`.
3. Partial name (`first word of a real restaurant's name`) → resolves to that restaurant.
4. Non-string input (`undefined`, `42`) → `undefined`, no throw.

**Verify**: `npx vitest run tests/agent-tools.test.js` → all 4 pass.

## Test plan

- New `tests/agent-tools.test.js` (4 cases above; no LLM calls).
- Existing suites must pass unmodified.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0 (including new `tests/agent-tools.test.js`)
- [ ] `npm run lint` exits 0
- [ ] `grep -n "restaurants\[args" src/agent/tools.js` → no matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 014 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (especially if `restaurants` is no longer an array — the fix shape depends on it).
- `executeTool` is no longer exported or the `generate_review` case moved.
- The catalogue file has zero entries with `restaurant_id` (test can't derive an id — report).
- Fixing requires touching `generateReview`, prompts, or other tools.

## Maintenance notes

- The lookup is still O(n); a shared id-keyed catalogue Map is the follow-up (perf concern, separate plan) — this plan intentionally keeps the diff minimal.
- Reviewer: confirm name-fallback behavior is byte-identical for existing inputs (only id inputs change outcome).
- Deferred: live end-to-end review generation test (needs LLM key; covered by manual smoke only).
