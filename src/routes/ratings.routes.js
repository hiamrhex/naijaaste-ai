import { asyncRouter } from '../lib/async-router.js';
import { requireAuth } from '../auth/middleware.js';
import { ok, fail } from '../lib/respond.js';
import { createRating, listRatingsByUser } from '../ratings/store.js';
import { findRestaurantByCode } from '../db/catalogue.js';

const router = asyncRouter();
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
  // A rating is only meaningful against a real restaurant. Without this check
  // any string was stored (there is no FK: the id may be a code or an osm_id),
  // so typos and made-up ids entered the recommendation data silently.
  if (!(await findRestaurantByCode(restaurant_id))) {
    return fail(res, { status: 404, code: 'NOT_FOUND', message: 'Unknown restaurant', requestId: req.id });
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
