import { v4 as uuidv4 } from 'uuid';
import { callPersonaLLM } from './llm.service.js';
import { buildPersonaPrompt } from '../prompts/persona.prompts.js';
import { MIN_RAW_TEXT } from '../schemas/index.js';

// Valid enum values for post-extraction validation
const VALID_ENUMS = {
  city: ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu', 'Benin City', 'Calabar'],
  income_level: ['low', 'middle', 'high'],
  budget_level: ['budget', 'mid_range', 'premium'],
  spice_tolerance: ['mild', 'medium', 'hot', 'extra_hot'],
  ambience_preference: ['buka', 'casual_dining', 'fine_dining', 'outdoor_suya_spot'],
  value_sensitivity: ['price_conscious', 'value_seeker', 'quality_first'],
  social_context: ['solo', 'date_night', 'family_outing', 'business_lunch', 'owambe_crew']
};

const VALID_CUISINES = ['Yoruba', 'Igbo', 'Hausa-Fulani', 'Delta', 'Efik', 'Bini', 'Afro-fusion', 'Street Food', 'Suya-Grills', 'Lagos Contemporary'];
const VALID_DIETARY = ['none', 'no_pork', 'no_alcohol', 'low_oil', 'vegetarian', 'halal'];

// Validate and sanitize LLM output
// Prevents invalid enums from breaking downstream services
const sanitizePersona = (extracted) => {
  const sanitized = { ...extracted };
  const warnings = [];

  // Validate single enum fields
  for (const [field, validValues] of Object.entries(VALID_ENUMS)) {
    if (!validValues.includes(sanitized[field])) {
      const fallbacks = {
        city: 'Lagos',
        income_level: 'middle',
        budget_level: 'mid_range',
        spice_tolerance: 'medium',
        ambience_preference: 'casual_dining',
        value_sensitivity: 'value_seeker',
        social_context: 'solo'
      };
      warnings.push(`Invalid ${field}: "${sanitized[field]}" → defaulted to "${fallbacks[field]}"`);
      sanitized[field] = fallbacks[field];
    }
  }

  // Validate preferred_cuisines array. A single value returned as a string is
  // wrapped rather than discarded.
  if (typeof sanitized.preferred_cuisines === 'string') {
    sanitized.preferred_cuisines = [sanitized.preferred_cuisines];
  }

  if (!Array.isArray(sanitized.preferred_cuisines) || sanitized.preferred_cuisines.length === 0) {
    sanitized.preferred_cuisines = ['Street Food'];
    warnings.push('preferred_cuisines was empty → defaulted to ["Street Food"]');
  } else {
    sanitized.preferred_cuisines = sanitized.preferred_cuisines.filter(c =>
      VALID_CUISINES.includes(c)
    );
    if (sanitized.preferred_cuisines.length === 0) {
      sanitized.preferred_cuisines = ['Street Food'];
      warnings.push('preferred_cuisines had no valid values → defaulted to ["Street Food"]');
    }
  }

  // Validate dietary_flags array
  if (typeof sanitized.dietary_flags === 'string') {
    sanitized.dietary_flags = [sanitized.dietary_flags];
  }

  if (!Array.isArray(sanitized.dietary_flags) || sanitized.dietary_flags.length === 0) {
    sanitized.dietary_flags = ['none'];
    warnings.push('dietary_flags was empty → defaulted to ["none"]');
  } else {
    sanitized.dietary_flags = sanitized.dietary_flags.filter(d =>
      VALID_DIETARY.includes(d)
    );
    if (sanitized.dietary_flags.length === 0) {
      sanitized.dietary_flags = ['none'];
    }
  }

  // Enforce income/budget consistency
  const inconsistent =
    (sanitized.income_level === 'low' && sanitized.budget_level === 'premium') ||
    (sanitized.income_level === 'low' && sanitized.budget_level === 'mid_range');

  if (inconsistent) {
    warnings.push(`income/budget mismatch: ${sanitized.income_level}/${sanitized.budget_level} → corrected budget to "budget"`);
    sanitized.budget_level = 'budget';
  }

  // Ensure age is a real number within bounds. A non-numeric value (or a
  // numeric string) used to slip through: NaN fails both comparisons.
  const age = Number(sanitized.age);
  if (!Number.isFinite(age) || age < 18 || age > 75) {
    sanitized.age = 28;
    warnings.push('age out of bounds → defaulted to 28');
  } else {
    sanitized.age = age;
  }

  return { sanitized, warnings };
};

export const extractPersona = async (rawText) => {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < MIN_RAW_TEXT) {
    throw new Error(
      `raw_text must be a non-empty string (min ${MIN_RAW_TEXT} characters)`
    );
  }

  const startTime = Date.now();

  // Build single combined prompt and call LLM
  const prompt = buildPersonaPrompt(rawText.trim());
  const extracted = await callPersonaLLM(prompt);

  // Sanitize and validate LLM output
  const { sanitized, warnings } = sanitizePersona(extracted);

  // Stamp server-generated fields — the model must never set these. They come
  // after the spread so a model-supplied value cannot overwrite them.
  const persona = {
    ...sanitized,
    persona_id: uuidv4(),
    preference_history: [],
    created_at: new Date().toISOString()
  };

  return {
    ...persona,
    _meta: {
      extraction_warnings: warnings.length > 0 ? warnings : null,
      latency_ms: Date.now() - startTime
    }
  };
};