// Deterministic fallback — the answer we give when the model is slow, dead or
// over-quota. It never calls Gemini: it reads the real catalogue from Postgres
// and ranks it with the same pre-score the AI path uses, so the user still
// gets honest, sourced restaurant names instead of an error page.

import { getDeterministicRecommendations, hardFilterRestaurants } from './recommend.service.js';
import { getCatalogue, getCatalogueByCity } from '../db/catalogue.js';
import { buildFallbackPersona, extractHints, searchTerms } from './hints.service.js';
import { logger } from '../lib/logger.js';

export { extractHints, buildFallbackPersona, searchTerms };

// Pull real restaurants out of the catalogue without the model.
// Honesty + safety rules:
//   - we only return rows we can justify: a dish the user actually named, or
//     the city they told us about;
//   - dietary hard filters still apply (a halal diner never sees pork);
//   - with neither a dish nor a city we return nothing, so the caller can
//     answer with a typed error instead of guessing.
const searchCatalogue = async (terms, persona) => {
  const city = persona?.city_known ? persona.city : null;
  const rows = city ? await getCatalogueByCity(city) : await getCatalogue();
  const eligible = hardFilterRestaurants(rows, persona);

  if (terms.length) {
    const scored = eligible
      .map((r) => {
        const haystack = [
          r.name,
          ...(r.cuisine_tags || []),
          ...(r.signature_dishes || []),
          r.description,
        ].filter(Boolean).join(' ').toLowerCase();
        const hits = terms.filter((t) => haystack.includes(t)).length;
        return { r, hits };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    return scored.slice(0, 5).map((x) => x.r);
  }
  // No dish named: a known city is enough to offer its listings.
  return city ? eligible.slice(0, 5) : [];
};

const toPick = (r, i) => ({
  rank: i + 1,
  restaurant_id: r.restaurant_id,
  restaurant_name: r.name,
  city: r.city,
  area: r.area || null,
  cuisine: (r.cuisine_tags || [])[0] || null,
  match_score: null,
  reasoning: r.description
    ? String(r.description).slice(0, 140)
    : `A ${r.city} listing matched your request in the catalogue.`,
  predicted_rating: typeof r.average_rating === 'number' ? r.average_rating : null,
  why_they_will_love_it: (r.signature_dishes || [])[0]
    ? `Known for ${r.signature_dishes[0]}.`
    : 'A solid local option from our catalogue.',
  potential_concern: null,
  source: r._source || 'catalogue',
});

/**
 * Deterministic answer for the agent path.
 * Returns null when even the catalogue cannot help (no city, no match).
 */
export const deterministicAgentReply = async (session, userMessage, reason = 'LLM_UNAVAILABLE') => {
  const persona = buildFallbackPersona(session, userMessage);
  const terms = searchTerms(userMessage);

  let picks = [];
  try {
    if (persona.city_known) {
      const result = await getDeterministicRecommendations(persona, reason);
      picks = (result?.recommendations || []).map((r, i) => ({
        ...r,
        rank: i + 1,
        city: persona.city,
      }));
    }
    if (!picks.length) {
      const rows = await searchCatalogue(terms, persona);
      picks = rows.map(toPick);
    }
  } catch (err) {
    logger.error({ err: err?.message }, 'deterministic fallback failed');
    return null;
  }

  if (!picks.length) return null;

  const names = picks.slice(0, 3).map((p) => p.restaurant_name).filter(Boolean);
  const text = names.length
    ? `Live AI is busy right now, so here are straight-from-the-catalogue picks for ${persona.city}: ${names.join(', ')}. Tell me more about your taste and I'll sharpen the list.`
    : 'Live AI is busy right now. Try again in a moment for a fully personalised answer.';

  return {
    text,
    picks,
    persona,
    reason,
  };
};

export const deterministicChatReply = async (session, userMessage, reason = 'LLM_UNAVAILABLE') => {
  const result = await deterministicAgentReply(session, userMessage, reason);
  if (!result) return null;
  return {
    message: result.text,
    recommendations: result.picks.length
      ? { success: true, fallback: true, recommendations: result.picks }
      : null,
    persona: result.persona,
  };
};
