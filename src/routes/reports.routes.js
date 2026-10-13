import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { ok, fail } from '../lib/respond.js';
import { createReport, REPORT_TYPES } from '../reports/store.js';

const router = Router();
const MAX_SCREENSHOT_BYTES = 300 * 1024;

router.post('/reports', requireAuth, async (req, res) => {
  const { type, message, screen, device, app_version, restaurant_id, screenshot } = req.body || {};
  if (!REPORT_TYPES.includes(type)) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: `type must be one of: ${REPORT_TYPES.join(', ')}`, requestId: req.id });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 3 || message.length > 2000) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'message must be 3–2000 characters', requestId: req.id });
  }
  if (screenshot !== undefined) {
    if (typeof screenshot !== 'string' || !screenshot.startsWith('data:image/')) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'screenshot must be an image data URL', requestId: req.id });
    }
    if (screenshot.length > MAX_SCREENSHOT_BYTES) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'screenshot is too large (max ~300KB)', requestId: req.id });
    }
  }
  const report = await createReport({
    userId: req.user.id,
    type,
    message: message.trim(),
    screen: typeof screen === 'string' ? screen.slice(0, 120) : null,
    device: typeof device === 'string' ? device.slice(0, 200) : null,
    appVersion: typeof app_version === 'string' ? app_version.slice(0, 40) : null,
    requestId: req.id,
    restaurantId: typeof restaurant_id === 'string' ? restaurant_id : null,
    screenshot,
  });
  return ok(res, report, undefined, 201);
});

export { router as reportsRoutes };
