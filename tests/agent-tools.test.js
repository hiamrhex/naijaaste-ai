import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findRestaurantByIdOrName } from '../src/agent/tools.js';

// Plan 014: pure lookup tests — no LLM calls.
const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(readFileSync(join(__dirname, '..', 'src/data/restaurants.json'), 'utf-8'));
const known = catalogue.find((r) => r.restaurant_id && r.name);

describe('findRestaurantByIdOrName (plan 014)', () => {
  it('resolves a real restaurant_id', () => {
    const found = findRestaurantByIdOrName(known.restaurant_id);
    expect(found?.restaurant_id).toBe(known.restaurant_id);
  });

  it('returns undefined for an unknown id', () => {
    expect(findRestaurantByIdOrName('no-such-place-xyz')).toBeUndefined();
  });

  it('falls back to partial name search', () => {
    const firstWord = known.name.split(' ')[0];
    const found = findRestaurantByIdOrName(firstWord);
    expect(found?.name).toContain(firstWord);
  });

  it('returns undefined for non-string input without throwing', () => {
    expect(findRestaurantByIdOrName(undefined)).toBeUndefined();
    expect(findRestaurantByIdOrName(42)).toBeUndefined();
  });
});
