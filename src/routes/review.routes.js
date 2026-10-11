import { Router } from 'express';
import { generateReview } from '../services/review.service.js';
import { notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { extractReviewSchema } from '../schemas/index.js';

const router = Router();

router.post('/generate-review', validate(extractReviewSchema), async (req, res, next) => {
  try {
    const { persona, restaurant } = req.body;

    const result = await generateReview(persona, restaurant);
    if (result.success === false) {
      return next(notFound('RESTAURANT_NOT_FOUND', result.error));
    }
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export { router as reviewRoutes };
