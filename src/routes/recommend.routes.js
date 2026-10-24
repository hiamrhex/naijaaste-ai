import { Router } from 'express';
import { getRecommendations } from '../services/recommend.service.js';
import { notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { recommendSchema } from '../schemas/index.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

// Optional auth: if user is signed in, attach user to req; if not, continue anonymously
const optionalAuth = async (req, res, next) => {
  const { verifyAccessToken } = await import('../auth/tokens.js');
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(auth.slice(7).trim());
      if (payload?.sub) req.user = { id: payload.sub };
    } catch { /* ignore invalid token */ }
  }
  next();
};

router.post('/recommend', optionalAuth, validate(recommendSchema), async (req, res, next) => {
  try {
    const { persona } = req.body;
    const quotaSubject = req.user
      ? { id: req.user.id, type: 'user' }
      : (persona?.persona_id ? { id: persona.persona_id, type: 'persona' } : null);

    const result = await getRecommendations(persona, { quotaSubject });
    if (result.success === false) {
      return next(notFound('NO_MATCHES', result.error));
    }
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export { router as recommendRoutes };
