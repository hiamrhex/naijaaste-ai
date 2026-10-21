// Shared, mutation-only-from-the-pool timing bag. Kept separate from
// db/pool.js so request logging does not depend on (or break) tests that
// partially mock the pool.
const timing = { createMs: null, wakeMs: null, initMs: null, readyAt: null };

export const getDbTiming = () => ({ ...timing });

export const setDbTiming = (patch) => Object.assign(timing, patch);

export const resetDbTiming = () =>
  Object.assign(timing, { createMs: null, wakeMs: null, initMs: null, readyAt: null });
