import { describe, it, expect } from 'vitest';
import { rankSaved } from '../src/lib/rankSaved.js';

// RED slice 1 — grill Q4 decision rule:
// pass/fail/unknown per constraint, fail=excluded, Fits=all pass,
// Might-fit=no fails sorted most-passes then fewest-unknowns.

describe('rankSaved (RED)', () => {
  it('splits Fits vs Might-fit and excludes hard fails', () => {
    const places = [
      { id: 'a', name: 'Terra', area: 'Yaba', price_per_head_ngn: 7000 },
      { id: 'b', name: 'Buka Queen', area: 'Yaba', price_per_head_ngn: null },
      { id: 'c', name: 'Far Away', area: 'Abuja', price_per_head_ngn: 5000 },
    ];
    const constraints = { area: 'Yaba', maxPricePerHead: 8000 };
    const { fits, might } = rankSaved(places, constraints);

    expect(fits.map((p) => p.id)).toEqual(['a']);
    expect(might.map((p) => p.id)).toEqual(['b']);
    expect(might[0].unknowns).toContain('price');
  });
});
