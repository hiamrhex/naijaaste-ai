// Deterministic, model-free extraction of the few facts we actually need.
// Used by the fallback paths (persona extraction, agent reply) so the product
// keeps working when Gemini is slow, over-quota or unavailable.

export const CITIES = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan',
  'Enugu', 'Benin City', 'Calabar',
];

const CITY_HINTS = [
  ['port harcourt', 'Port Harcourt'],
  ['p.harcourt', 'Port Harcourt'],
  ['benin city', 'Benin City'],
  ['benin', 'Benin City'],
  ['calabar', 'Calabar'],
  ['ibadan', 'Ibadan'],
  ['enugu', 'Enugu'],
  ['kano', 'Kano'],
  ['abuja', 'Abuja'],
  ['lagos', 'Lagos'],
];

const BUDGET_HINTS = [
  ['tight', 'budget'],
  ['cheap', 'budget'],
  ['budget', 'budget'],
  ['low', 'budget'],
  ['mid', 'mid_range'],
  ['mid-range', 'mid_range'],
  ['midrange', 'mid_range'],
  ['average', 'mid_range'],
  ['premium', 'premium'],
  ['expensive', 'premium'],
  ['high', 'premium'],
  ['luxury', 'premium'],
];

const SPICE_HINTS = [
  ['no spice', 'mild'],
  ['mild', 'mild'],
  ['light', 'mild'],
  ['medium', 'medium'],
  ['spicy', 'hot'],
  ['hot', 'hot'],
  ['very spicy', 'extra_hot'],
  ['extra hot', 'extra_hot'],
  ['fire', 'extra_hot'],
];

const CONTEXT_HINTS = [
  ['date', 'date_night'],
  ['romantic', 'date_night'],
  ['family', 'family_outing'],
  ['kids', 'family_outing'],
  ['business', 'business_lunch'],
  ['work', 'business_lunch'],
  ['party', 'owambe_crew'],
  ['owambe', 'owambe_crew'],
  ['solo', 'solo'],
  ['alone', 'solo'],
];

// Pull what we can out of the user's own words — no model involved.
export const extractHints = (message = '') => {
  const text = String(message).toLowerCase();
  const hints = {};

  for (const [needle, city] of CITY_HINTS) {
    if (text.includes(needle)) { hints.city = city; break; }
  }
  for (const [needle, level] of BUDGET_HINTS) {
    if (text.includes(needle)) { hints.budget_level = level; break; }
  }
  for (const [needle, level] of SPICE_HINTS) {
    if (text.includes(needle)) { hints.spice_tolerance = level; break; }
  }
  for (const [needle, context] of CONTEXT_HINTS) {
    if (text.includes(needle)) { hints.social_context = context; break; }
  }

  return hints;
};

export const DEFAULTS = {
  budget_level: 'mid_range',
  spice_tolerance: 'medium',
  ambience_preference: 'casual_dining',
  social_context: 'solo',
  preferred_cuisines: ['Street Food'],
  dietary_flags: ['none'],
};

// Merge what the session already knows with what the message just said.
export const buildFallbackPersona = (session, userMessage) => {
  const known = session?.extracted_persona || {};
  const hints = extractHints(userMessage);
  const city = hints.city || known.city || (CITIES.includes(known.city) ? known.city : null);

  return {
    persona_id: known.persona_id || `fallback-${Date.now()}`,
    full_name: known.full_name || 'Guest',
    age: known.age || 28,
    city: city || 'Lagos',
    city_known: !!city,
    occupation: known.occupation || 'Not specified',
    income_level: known.income_level || 'middle',
    budget_level: hints.budget_level || known.budget_level || DEFAULTS.budget_level,
    spice_tolerance: hints.spice_tolerance || known.spice_tolerance || DEFAULTS.spice_tolerance,
    ambience_preference: known.ambience_preference || DEFAULTS.ambience_preference,
    value_sensitivity: known.value_sensitivity || 'value_seeker',
    social_context: hints.social_context || known.social_context || DEFAULTS.social_context,
    preferred_cuisines: known.preferred_cuisines || DEFAULTS.preferred_cuisines,
    dietary_flags: known.dietary_flags || DEFAULTS.dietary_flags,
    preference_history: known.preference_history || [],
    created_at: known.created_at || new Date().toISOString(),
  };
};

// Dish/cuisine words worth searching for when we have no city to work with.
export const DISH_HINTS = [
  'jollof', 'suya', 'amala', 'pounded yam', 'egusi', 'afang', 'edikang ikong',
  'pepper soup', 'banga', 'abacha', 'fried rice', 'shawarma', 'burger',
  'pizza', 'pasta', 'seafood', 'grilled fish', 'chin chin', 'puff puff',
];

export const searchTerms = (message = '') => {
  const text = String(message).toLowerCase();
  return DISH_HINTS.filter((d) => text.includes(d));
};
