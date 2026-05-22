import { Router } from 'express';
import { generateReview } from '../services/review.service.js';

const router = Router();

router.post('/generate-review', async (req, res) => {
  try {
    const { persona, restaurant } = req.body;

    if (!persona || !restaurant) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain both persona and restaurant objects'
      });
    }

    // Required fields
    const requiredPersona = ['persona_id', 'city', 'budget_level', 'spice_tolerance'];
    const requiredRestaurant = ['restaurant_id', 'name', 'city', 'ambience', 'spice_profile'];

    const missingPersona = requiredPersona.filter(f => !persona[f]);
    const missingRestaurant = requiredRestaurant.filter(f => !restaurant[f]);

    if (missingPersona.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing persona fields: ${missingPersona.join(', ')}`
      });
    }

    if (missingRestaurant.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing restaurant fields: ${missingRestaurant.join(', ')}`
      });
    }

    const result = await generateReview(persona, restaurant);
    return res.status(200).json(result);

  } catch (error) {
    console.error('[generate-review] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Review generation failed',
      detail: error.message
    });
  }
});

export { router as reviewRoutes };