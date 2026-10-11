import { Router } from 'express';
import { getRecommendations } from '../services/recommend.service.js';
import { notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { recommendSchema } from '../schemas/index.js';

const router = Router();

router.post('/recommend', validate(recommendSchema), async (req, res, next) => {
  try {
    const { persona } = req.body;

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
