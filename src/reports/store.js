import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../lib/logger.js';

// Feedback inbox (D): user reports with auto-attached diagnostics and a
// thank-you ticket ID. Admin triages via status. JSON-file store.
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const FILE = join(DATA_DIR, 'reports.json');

export const REPORT_TYPES = ['bug', 'wrong-info', 'idea', 'other'];
export const REPORT_STATUSES = ['open', 'in_review', 'resolved'];

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const load = () => {
  try {
    if (!existsSync(FILE)) return [];
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

let reports = load();

const persist = () => {
  try {
    writeFileSync(FILE, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'reports persist failed');
  }
};

const makeTicket = () => {
  const n = Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0');
  return `NT-${n}`;
};

export const createReport = ({ userId, type, message, screen, device, appVersion, requestId, restaurantId, screenshot }) => {
  const report = {
    ticket: makeTicket(),
    user_id: userId,
    type,
    message,
    screen: screen || null,
    device: device || null,
    app_version: appVersion || null,
    request_id: requestId || null,
    restaurant_id: restaurantId || null,
    has_screenshot: !!screenshot,
    screenshot: screenshot || null,
    status: 'open',
    at: new Date().toISOString(),
  };
  reports.push(report);
  persist();
  const { screenshot: _drop, ...publicView } = report;
  return publicView;
};

export const listReports = (status) =>
  reports.filter((r) => !status || r.status === status).map(({ screenshot: _drop, ...r }) => r);

export const setReportStatus = (ticket, status) => {
  const r = reports.find((x) => x.ticket === ticket);
  if (!r) return null;
  r.status = status;
  persist();
  const { screenshot: _drop, ...publicView } = r;
  return publicView;
};

export const countReportsByStatus = () => {
  const counts = { open: 0, in_review: 0, resolved: 0 };
  for (const r of reports) {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  }
  return counts;
};
