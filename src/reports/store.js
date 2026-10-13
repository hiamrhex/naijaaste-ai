import { getPool } from '../db/pool.js';

// Feedback inbox (D): user reports with auto-attached diagnostics and a
// thank-you ticket ID. Admin triages via status. Postgres-backed.
export const REPORT_TYPES = ['bug', 'wrong-info', 'idea', 'other'];
export const REPORT_STATUSES = ['open', 'in_review', 'resolved'];

const stripBlob = ({ screenshot: _drop, ...r }) => r;

const makeTicket = () => {
  const n = Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0');
  return `NT-${n}`;
};

export const createReport = async ({ userId, type, message, screen, device, appVersion, requestId, restaurantId, screenshot }) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    `INSERT INTO reports
       (ticket, user_id, type, message, screen, device, app_version, request_id,
        restaurant_id, has_screenshot, screenshot, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open') RETURNING *`,
    [makeTicket(), userId, type, message, screen || null, device || null,
      appVersion || null, requestId || null, restaurantId || null,
      !!screenshot, screenshot || null]
  );
  const r = rows[0];
  r.at = r.at instanceof Date ? r.at.toISOString() : r.at;
  return stripBlob(r);
};

export const listReports = async (status) => {
  const pool = await getPool();
  const { rows } = status
    ? await pool.query('SELECT ticket, user_id, type, message, screen, device, app_version, request_id, restaurant_id, has_screenshot, status, at FROM reports WHERE status = $1 ORDER BY at DESC', [status])
    : await pool.query('SELECT ticket, user_id, type, message, screen, device, app_version, request_id, restaurant_id, has_screenshot, status, at FROM reports ORDER BY at DESC');
  return rows.map((r) => ({ ...r, at: r.at instanceof Date ? r.at.toISOString() : r.at }));
};

export const setReportStatus = async (ticket, status) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    `UPDATE reports SET status = $2 WHERE ticket = $1
     RETURNING ticket, user_id, type, message, screen, device, app_version,
       request_id, restaurant_id, has_screenshot, status, at`,
    [ticket, status]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  r.at = r.at instanceof Date ? r.at.toISOString() : r.at;
  return r;
};

export const countReportsByStatus = async () => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT status, count(*)::int AS n FROM reports GROUP BY status');
  const counts = { open: 0, in_review: 0, resolved: 0 };
  for (const r of rows) {
    if (counts[r.status] !== undefined) counts[r.status] = r.n;
  }
  return counts;
};
