// Minimal ranker for memory-first list UI (grill Q4 rule).
// Pure: pass/fail/unknown per stated constraint, fail=excluded,
// Fits=all pass, Might-fit=no fails sorted most-passes then fewest-unknowns.
export const rankSaved = (places = [], constraints = {}) => {
  const areaWanted = (constraints.area || '').trim().toLowerCase() || null;
  const maxPrice = constraints.maxPricePerHead ?? null;

  const scored = [];
  for (const p of places) {
    let passes = 0;
    const unknowns = [];
    let failed = false;

    if (areaWanted) {
      const a = (p.area || '').trim().toLowerCase() || null;
      if (!a) unknowns.push('area');
      else if (a === areaWanted) passes += 1;
      else failed = true;
    }
    if (maxPrice !== null) {
      const v = p.price_per_head_ngn ?? null;
      if (v === null || v === undefined) unknowns.push('price');
      else if (v <= maxPrice) passes += 1;
      else failed = true;
    }
    if (failed) continue;
    scored.push({ place: p, passes, unknowns });
  }

  const fits = scored.filter((s) => s.unknowns.length === 0).map((s) => s.place);
  const might = scored
    .filter((s) => s.unknowns.length > 0)
    .sort((x, y) => y.passes - x.passes || x.unknowns.length - y.unknowns.length)
    .map((s) => ({ ...s.place, unknowns: s.unknowns }));

  return { fits, might };
};
