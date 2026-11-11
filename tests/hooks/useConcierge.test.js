// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readHistory, HISTORY_KEY } from '../../src/hooks/useConcierge.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('readHistory', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(readHistory()).toEqual([]);
  });

  it('returns an empty list for corrupt JSON', () => {
    localStorage.setItem(HISTORY_KEY, '{not json');
    expect(readHistory()).toEqual([]);
  });

  it('returns an empty list when the stored value is not an array', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ preview: 'oops' }));
    expect(readHistory()).toEqual([]);

    localStorage.setItem(HISTORY_KEY, JSON.stringify('oops'));
    expect(readHistory()).toEqual([]);
  });

  it('drops junk entries instead of handing them to the screen', () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([null, 7, 'nope', [], { preview: 'jollof', session_id: 's1' }])
    );

    expect(readHistory()).toEqual([{ preview: 'jollof', session_id: 's1' }]);
  });

  it('keeps valid entries untouched', () => {
    const entries = [
      { preview: 'newest', session_id: 'b', at: '2026-01-02T00:00:00.000Z' },
      { preview: 'older', session_id: 'a', at: '2026-01-01T00:00:00.000Z' },
    ];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));

    expect(readHistory()).toEqual(entries);
  });
});
