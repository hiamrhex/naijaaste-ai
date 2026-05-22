import { Router } from 'express';
import { extractPersona } from '../services/persona.service.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Extract Persona ──────────────────────────────────────────────────────────
router.post('/extract-persona', async (req, res) => {
  try {
    const { raw_text } = req.body;

    if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'raw_text is required and must be at least 10 characters'
      });
    }

    const persona = await extractPersona(raw_text.trim());

    return res.status(200).json({
      success: true,
      persona,
      meta: {
        extracted_from: raw_text.substring(0, 100) + (raw_text.length > 100 ? '...' : ''),
        preference_history: [],
        ready_for: ['recommend', 'generate-review']
      }
    });

  } catch (error) {
    console.error('[extract-persona] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Persona extraction failed',
      detail: error.message
    });
  }
});

// ─── Update Preference ────────────────────────────────────────────────────────
router.post('/update-preference', async (req, res) => {
  try {
    const { persona, signal } = req.body;

    if (!persona || !signal) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain both persona and signal objects'
      });
    }

    // Validate signal shape
    const requiredSignalFields = ['dimension', 'value', 'rating'];
    const missingFields = requiredSignalFields.filter(f => signal[f] === undefined);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing signal fields: ${missingFields.join(', ')}`,
        expected_signal_shape: {
          dimension: 'ambience | budget | spice | cuisine | social_context',
          value: 'the specific value e.g. buka, premium, hot',
          rating: 'integer 1-5 from user feedback'
        }
      });
    }

    // Validate rating range
    if (signal.rating < 1 || signal.rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'signal.rating must be between 1 and 5'
      });
    }

    // Compute recency-aware weight
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

  } catch (error) {
    console.error('[update-preference] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Preference update failed',
      detail: error.message
    });
  }
});

export { router as personaRoutes };