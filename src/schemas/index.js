import { z } from 'zod';

export const MIN_RAW_TEXT = 10;

// Loosely typed pass-through: LLM-extracted personas are open-ended objects.
// recommend persona — five required keys (route parity)
export const personaSchema = z.object({
  persona_id: z.string().min(1),
  city: z.string().min(1),
  budget_level: z.string().min(1),
  spice_tolerance: z.string().min(1),
  ambience_preference: z.string().min(1),
  preferred_cuisines: z.array(z.any()),
  dietary_flags: z.array(z.any()),
}).passthrough();

// generate-review persona — four required keys only (exact route parity)
export const reviewPersonaSchema = z.object({
  persona_id: z.string().min(1),
  city: z.string().min(1),
  budget_level: z.string().min(1),
  spice_tolerance: z.string().min(1),
  preferred_cuisines: z.array(z.any()),
  dietary_flags: z.array(z.any()),
}).passthrough();

export const restaurantSchema = z.object({
  restaurant_id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  ambience: z.string().min(1),
  spice_profile: z.string().min(1),
  cuisine_tags: z.array(z.any()),
  signature_dishes: z.array(z.any()),
  social_tags: z.array(z.any()),
  price_range_naira: z.object({ min: z.number(), max: z.number() }),
}).passthrough();

export const chatBodySchema = z.object({
  message: z.string({ required_error: 'message is required' })
    .trim().min(1, 'message is required').max(500),
  session_id: z.string().uuid().optional(),
});

export const extractPersonaSchema = z.object({
  raw_text: z.string({ required_error: 'raw_text is required and must be at least 10 characters' })
    .trim().min(MIN_RAW_TEXT, 'raw_text is required and must be at least 10 characters'),
});

export const extractReviewSchema = z.object({
  persona: reviewPersonaSchema,
  restaurant: restaurantSchema,
});

export const recommendSchema = z.object({
  persona: personaSchema,
});

export const updatePreferenceSchema = z.object({
  persona: z.object({ preference_history: z.array(z.any()).optional() }).passthrough(),
  signal: z.object({
    dimension: z.string().min(1),
    value: z.string().min(1),
    rating: z.number().int('signal.rating must be between 1 and 5')
      .min(1, 'signal.rating must be between 1 and 5')
      .max(5, 'signal.rating must be between 1 and 5'),
    restaurant_id: z.string().optional(),
  }),
});
