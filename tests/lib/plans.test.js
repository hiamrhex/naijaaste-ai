// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PLANS_KEY, readPlans, writePlans, deletePlan } from '../../src/lib/plans.js';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('plans storage', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(readPlans()).toEqual([]);
  });

  it('returns an empty list when the stored value is corrupt', () => {
    localStorage.setItem(PLANS_KEY, '{not-json');
    expect(readPlans()).toEqual([]);
  });

  it('returns an empty list when the stored value is not an array', () => {
    localStorage.setItem(PLANS_KEY, JSON.stringify({ id: 'p1' }));
    expect(readPlans()).toEqual([]);
  });

  it('keeps the newest 20 plans when more are written', () => {
    const plans = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}` }));

    writePlans(plans);

    const stored = readPlans();
    expect(stored).toHaveLength(20);
    expect(stored[0].id).toBe('p5');
    expect(stored[19].id).toBe('p24');
  });

  it('survives a storage quota failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writePlans([{ id: 'p1' }])).not.toThrow();
  });

  it('deletes a plan by id and leaves the rest intact', () => {
    writePlans([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    deletePlan('b');

    expect(readPlans().map(p => p.id)).toEqual(['a', 'c']);
  });
});
