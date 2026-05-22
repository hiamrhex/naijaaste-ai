import { Router } from 'express';
import { getRecommendations } from '../services/recommend.service.js';

const router = Router();

router.post('/recommend', async (req, res) => {
  try {
    const { persona } = req.body;

    if (!persona) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain a persona object'
      });
    }

    // Required persona fields
    const required = ['persona_id', 'city', 'budget_level', 'spice_tolerance', 'ambience_preference'];
    const missing = required.filter(f => !persona[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required persona fields: ${missing.join(', ')}`
      });
    }

    const result = await getRecommendations(persona);
    return res.status(result.success === false ? 404 : 200).json(result);

  } catch (error) {
    console.error('[recommend] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Recommendation engine failed',
      detail: error.message
    });
  }
});

export { router as recommendRoutes };