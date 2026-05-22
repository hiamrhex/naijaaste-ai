import { v4 as uuidv4 } from 'uuid';
import { callPersonaLLM } from './llm.service.js';
import { buildPersonaPrompt } from '../prompts/persona.prompts.js';

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

  // Validate preferred_cuisines array
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

  // Ensure age is within bounds
  if (!sanitized.age || sanitized.age < 18 || sanitized.age > 75) {
    sanitized.age = 28;
    warnings.push('age out of bounds → defaulted to 28');
  }

  return { sanitized, warnings };
};

export const extractPersona = async (rawText) => {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 5) {
    throw new Error('raw_text must be a non-empty string (min 5 characters)');
  }

  const startTime = Date.now();

  // Build single combined prompt and call LLM
  const prompt = buildPersonaPrompt(rawText.trim());
  const extracted = await callPersonaLLM(prompt);

  // Sanitize and validate LLM output
  const { sanitized, warnings } = sanitizePersona(extracted);

  // Stamp server-generated fields — LLM never sets these
  const persona = {
    persona_id: uuidv4(),
    ...sanitized,
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