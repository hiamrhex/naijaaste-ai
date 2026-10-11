import { Router } from 'express';
import { getRecommendations } from '../services/recommend.service.js';
import { badRequest, notFound } from '../lib/errors.js';

const router = Router();

router.post('/recommend', async (req, res, next) => {
  try {
    const { persona } = req.body;

    if (!persona) {
      return next(badRequest('Request body must contain a persona object'));
    }

    // Required persona fields
    const required = ['persona_id', 'city', 'budget_level', 'spice_tolerance', 'ambience_preference'];
    const missing = required.filter(f => !persona[f]);
    if (missing.length > 0) {
      return next(badRequest(`Missing required persona fields: ${missing.join(', ')}`));
    }

    const arrayFields = ['preferred_cuisines', 'dietary_flags'];
    const badArrays = arrayFields.filter(f => !Array.isArray(persona[f]));
    if (badArrays.length > 0) {
      return next(badRequest(`Persona fields must be arrays: ${badArrays.join(', ')}`));
    }

    const result = await getRecommendations(persona);
    if (result.success === false) {
      return next(notFound('NO_MATCHES', result.error));
    }
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export { router as recommendRoutes };
