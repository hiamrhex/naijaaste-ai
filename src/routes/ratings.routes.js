import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { ok, fail } from '../lib/respond.js';
import { createRating, listRatingsByUser } from '../ratings/store.js';

const router = Router();
const CONTEXTS = ['saved', 'planned', 'shared'];

router.post('/ratings', requireAuth, async (req, res) => {
  const { restaurant_id, stars, note, context } = req.body || {};
  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'restaurant_id is required', requestId: req.id });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'stars must be an integer 1–5', requestId: req.id });
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'note must be a string up to 500 characters', requestId: req.id });
  }
  if (context !== undefined && !CONTEXTS.includes(context)) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: `context must be one of: ${CONTEXTS.join(', ')}`, requestId: req.id });
  }
  const rating = await createRating({
    userId: req.user.id, restaurantId: restaurant_id, stars, note, context,
  });
  return ok(res, rating, undefined, 201);
});

router.get('/ratings', requireAuth, async (req, res) => {
  return ok(res, await listRatingsByUser(req.user.id));
});

export { router as ratingsRoutes };
