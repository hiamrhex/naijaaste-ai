import { Router } from 'express';
import { extractPersona } from '../services/persona.service.js';
import { validate } from '../middleware/validate.js';
import { extractPersonaSchema, updatePreferenceSchema } from '../schemas/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Extract Persona ──────────────────────────────────────────────────────────
router.post('/extract-persona', validate(extractPersonaSchema), async (req, res, next) => {
  try {
    const { raw_text } = req.body;

    const persona = await extractPersona(raw_text);

    return res.status(200).json({
      success: true,
      persona,
      meta: {
        extracted_from: raw_text.substring(0, 100) + (raw_text.length > 100 ? '...' : ''),
        preference_history: [],
        ready_for: ['recommend', 'generate-review']
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─── Update Preference ────────────────────────────────────────────────────────
router.post('/update-preference', validate(updatePreferenceSchema), async (req, res, next) => {
  try {
    const { persona, signal } = req.body;

    // Compute recency-aware weight (signal shape already validated by schema)
    const weight = signal.rating >= 4
      ? +0.4
      : signal.rating <= 2
      ? -0.3
      : +0.1;

    const newSignal = {
      signal_id: uuidv4(),
      signal: signal.rating >= 4 ? 'rated_high'
            : signal.rating <= 2 ? 'rated_low'
            : 'rated_neutral',
      dimension: signal.dimension,
      value: signal.value,
      weight,
      rating: signal.rating,
      restaurant_id: signal.restaurant_id || null,
      timestamp: new Date().toISOString()
    };

    // Keep last 10 signals — older signals naturally age out
    const updatedHistory = [
      ...(persona.preference_history || []),
      newSignal
    ].slice(-10);

    const updatedPersona = {
      ...persona,
      preference_history: updatedHistory
    };

    const previousState = (persona.preference_history?.length || 0) === 0
      ? 'cold_start'
      : 'warm';

    const currentState = updatedHistory.length > 0 ? 'warm' : 'cold_start';

    return res.status(200).json({
      success: true,
      updatedPersona,
      meta: {
        signals_count: updatedHistory.length,
        previous_state: previousState,
        current_state: currentState,
        state_transition: previousState !== currentState
          ? `${previousState} → ${currentState}`
          : null,
        latest_signal: newSignal
      }
    });
  } catch (err) {
    next(err);
  }
});

export { router as personaRoutes };
