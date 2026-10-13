import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { ok, fail } from '../lib/respond.js';
import { countUsers, countFavorites } from '../auth/store.js';
import { listReports, setReportStatus, countReportsByStatus, REPORT_STATUSES } from '../reports/store.js';
import { countRatings } from '../ratings/store.js';

const router = Router();

router.use('/admin', requireAuth, requireAdmin);

router.get('/admin/stats', async (req, res) => {
  return ok(res, {
    users: await countUsers(),
    favorites: await countFavorites(),
    ratings: await countRatings(),
    reports: await countReportsByStatus(),
  });
});

router.get('/admin/reports', async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !REPORT_STATUSES.includes(status)) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: `status must be one of: ${REPORT_STATUSES.join(', ')}`, requestId: req.id });
  }
  return ok(res, await listReports(status));
});

router.patch('/admin/reports/:ticket', async (req, res) => {
  const { status } = req.body || {};
  if (!REPORT_STATUSES.includes(status)) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: `status must be one of: ${REPORT_STATUSES.join(', ')}`, requestId: req.id });
  }
  const updated = await setReportStatus(req.params.ticket, status);
  if (!updated) {
    return fail(res, { status: 404, code: 'NOT_FOUND', message: 'Unknown ticket', requestId: req.id });
  }
  return ok(res, updated);
});

export { router as adminRoutes };
