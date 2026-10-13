import { getRecommendations } from '../services/recommend.service.js';
import { generateReview } from '../services/review.service.js';
import { getCatalogue, getCatalogueByCity, findRestaurantByCode, findRestaurantsByName } from '../db/catalogue.js';
import { v4 as uuidv4 } from 'uuid';

export const TOOL_DEFINITIONS = [
  {
    name: 'search_restaurants',
    description: 'Search the restaurant catalogue by city, cuisine, ambience, or price. Returns matching restaurants.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name, e.g. Lagos, Abuja, Ibadan' },
        cuisine: { type: 'string', description: 'Cuisine tag, e.g. Nigerian, Street Food, Afro-fusion' },
        ambience: { type: 'string', description: 'Ambience preference, e.g. casual, fine-dining, rooftop' },
        max_price: { type: 'string', description: 'Price tier ceiling: budget, mid, premium' },
      },
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get personalised restaurant recommendations for a user persona. Requires a persona with city, budget_level, spice_tolerance, ambience_preference, preferred_cuisines, dietary_flags.',
    parameters: {
      type: 'object',
      properties: {
        persona: { type: 'object', description: 'The full user persona object' },
      },
      required: ['persona'],
    },
  },
  {
    name: 'generate_review',
    description: 'Generate a short, vivid food review for a specific restaurant as if written by the user persona.',
    parameters: {
      type: 'object',
      properties: {
        restaurant_id: { type: 'string', description: 'Restaurant ID from search or recommendations' },
        persona: { type: 'object', description: 'The user persona to write from' },
      },
      required: ['restaurant_id'],
    },
  },
  {
    name: 'save_preference',
    description: 'Persist a taste signal (dimension, value, rating) to the user preference history. Dimensions: spice, budget, cuisine, ambience, social_context.',
    parameters: {
      type: 'object',
      properties: {
        dimension: { type: 'string', enum: ['spice', 'budget', 'cuisine', 'ambience', 'social_context'] },
        value: { type: 'string' },
        rating: { type: 'number', minimum: 1, maximum: 5 },
      },
      required: ['dimension', 'value', 'rating'],
    },
  },
];

const PRICE_ORDER = { budget: 1, mid: 2, premium: 3 };

// Plan 014: id-first lookup. The old code indexed the array with the id
// string (always undefined), so every real-id review call missed.
export const findRestaurantByIdOrName = async (idOrName) => {
  if (!idOrName || typeof idOrName !== 'string') return undefined;
  const byId = await findRestaurantByCode(idOrName);
  if (byId) return byId;
  const matches = await findRestaurantsByName(idOrName);
  return matches[0];
};

const executeTool = async (name, args, session) => {
  switch (name) {
    case 'search_restaurants': {
      // City pushdown at the DB; finer filters stay in JS.
      const base = args.city
        ? await getCatalogueByCity(args.city)
        : await getCatalogue();
      let results = base;
      if (args.cuisine) results = results.filter(r =>
        (r.cuisine_tags || []).some(c => c.toLowerCase().includes(args.cuisine.toLowerCase())) ||
        (r.signature_dishes || []).some(d => d.toLowerCase().includes(args.cuisine.toLowerCase()))
      );
      if (args.ambience) results = results.filter(r => r.ambience?.toLowerCase().includes(args.ambience.toLowerCase()));
      if (args.max_price) {
        const ceiling = PRICE_ORDER[args.max_price.toLowerCase()] ?? 3;
        results = results.filter(r => (PRICE_ORDER[r.price_tier?.toLowerCase()] ?? 2) <= ceiling);
      }
      return { count: results.length, restaurants: results.slice(0, 5) };
    }
    case 'get_recommendations': {
      const persona = args.persona || session.extracted_persona;
      if (!persona?.city) return { error: 'Persona missing city — ask the user first' };
      const fullPersona = {
        persona_id: uuidv4(),
        city: persona.city,
        budget_level: persona.budget_level || 'mid',
        spice_tolerance: persona.spice_tolerance || 'medium',
        ambience_preference: persona.ambience_preference || 'casual',
        preferred_cuisines: persona.preferred_cuisines || ['Street Food'],
        dietary_flags: persona.dietary_flags || ['none'],
        preference_history: persona.preference_history || [],
      };
      const result = await getRecommendations(fullPersona);
      if (result && !result.error) {
        session.recommendations = result;
        session.stage = 'recommend';
      }
      return result;
    }
    case 'generate_review': {
      const restaurant = await findRestaurantByIdOrName(args.restaurant_id);
      if (!restaurant) return { error: `Restaurant "${args.restaurant_id}" not found` };
      return await generateReview(args.persona || session.extracted_persona, restaurant);
    }
    case 'save_preference': {
      session.extracted_persona.preference_history = session.extracted_persona.preference_history || [];
      session.extracted_persona.preference_history.push({
        signal_id: uuidv4(),
        dimension: args.dimension,
        value: args.value,
        rating: args.rating,
        recorded_at: new Date().toISOString(),
      });
      return { saved: true, dimension: args.dimension, value: args.value, rating: args.rating };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
};

export { executeTool };
