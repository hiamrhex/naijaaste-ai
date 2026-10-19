// Monitoring hook — error tracking is opt-in via SENTRY_DSN.
// No DSN → everything here is a no-op (tests and local dev stay quiet).
// Redaction: authorization/cookies, auth-shaped body fields, URL query strings,
// tags (url/path), breadcrumbs and exception messages are scrubbed before
// anything leaves the process. Query values for token/key/auth and lat/lng are
// never sent.
import { env } from '../env.js';

let client = null;
let enabled = false;

const REDACTED = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';

const AUTH_KEY = /(token|key|authorization|password|passwd|secret|otp|cookie|session|credential)/i;
const EMAIL_KEY = /e[-_]?mail/i;
const GEO_KEY = /^(lat|lng|latitude|longitude|coords?)$/i;
const CODE_KEY = /^code$/i;

const QUERY_SECRET = /([?&](?:token|access_?token|refresh_?token|api_?key|key|authorization|auth|password|secret|otp|credential|code)=)[^&#\s]*/gi;
const QUERY_GEO = /([?&](?:lat|lng|latitude|longitude)=)[^&#\s]*/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._-]+/gi;

export const stripQuery = (value) => {
  if (typeof value !== 'string') return value;
  const q = value.indexOf('?');
  return q === -1 ? value : value.slice(0, q);
};

export const scrubString = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(QUERY_SECRET, `$1${REDACTED}`)
    .replace(QUERY_GEO, `$1${REDACTED}`)
    .replace(BEARER, `Bearer ${REDACTED}`);
};

// Pure + exported so tests can assert the exact redaction contract.
export const redactHeaders = (headers = {}) => {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization' || lower === 'cookie' || lower === 'proxy-authorization' || lower === 'set-cookie') {
      delete out[key];
    }
  }
  return out;
};

const scrubNode = (node, { includeCode = false } = {}) => {
  if (Array.isArray(node)) return node.map((item) => scrubNode(item, { includeCode }));
  if (!node || typeof node !== 'object') return scrubString(node);

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (EMAIL_KEY.test(key)) {
      out[key] = REDACTED_EMAIL;
    } else if (AUTH_KEY.test(key) || GEO_KEY.test(key) || (includeCode && CODE_KEY.test(key))) {
      out[key] = REDACTED;
    } else if (key.toLowerCase() === 'url' || key.toLowerCase() === 'path') {
      out[key] = stripQuery(scrubString(value));
    } else if (value && typeof value === 'object') {
      out[key] = scrubNode(value, { includeCode });
    } else {
      out[key] = scrubString(value);
    }
  }
  return out;
};

export const redactTags = (tags = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(tags)) {
    if (EMAIL_KEY.test(key)) {
      out[key] = REDACTED_EMAIL;
    } else if (AUTH_KEY.test(key) || GEO_KEY.test(key)) {
      out[key] = REDACTED;
    } else if (key.toLowerCase() === 'url' || key.toLowerCase() === 'path') {
      out[key] = stripQuery(scrubString(value));
    } else {
      out[key] = scrubString(value);
    }
  }
  return out;
};

export const redactBreadcrumbs = (breadcrumbs = []) =>
  breadcrumbs.map((breadcrumb) => {
    const out = { ...breadcrumb };
    if (out.data && typeof out.data === 'object') {
      out.data = scrubNode(out.data, { includeCode: true });
    }
    if (typeof out.message === 'string') out.message = scrubString(out.message);
    return out;
  });

export const redactEvent = (event) => {
  if (!event || typeof event !== 'object') return event;

  if (event.request) {
    if (event.request.headers) event.request.headers = redactHeaders(event.request.headers);
    if ('cookies' in event.request) delete event.request.cookies;
    if ('query_string' in event.request) delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(scrubString(event.request.url));
    if (event.request.data && typeof event.request.data === 'object') {
      event.request.data = scrubNode(event.request.data, { includeCode: true });
    }
  }
  if (event.tags) event.tags = redactTags(event.tags);
  if (event.extra) event.extra = scrubNode(event.extra, { includeCode: true });
  if (event.contexts) event.contexts = scrubNode(event.contexts, { includeCode: true });
  if (event.user) event.user = scrubNode(event.user, { includeCode: true });
  if (event.breadcrumbs) event.breadcrumbs = redactBreadcrumbs(event.breadcrumbs);
  if (typeof event.message === 'string') event.message = scrubString(event.message);
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v) => ({ ...v, value: scrubString(v.value) }));
  }
  return event;
};

export const initMonitoring = async () => {
  if (!env.SENTRY_DSN) return false; // quiet skip; nothing is sent anywhere
  if (enabled) return true;
  try {
    client = await import('@sentry/node');
    client.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV || 'development',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: redactEvent,
    });
    enabled = true;
  } catch (err) {
    // Logging/monitoring must never take the request path down.
    console.error('monitoring init failed:', err?.message);
  }
  return enabled;
};

export const captureException = (err, context = {}) => {
  if (!enabled) return;
  try {
    client.captureException(err, {
      tags: redactTags(context.tags || {}),
      extra: scrubNode(context.extra || {}, { includeCode: true }),
    });
  } catch { /* swallow — monitoring never breaks the request */ }
};

export const monitoringEnabled = () => enabled;

// Test-only seam: lets the error path assert exactly what would be sent.
export const __setClientForTests = (fake) => {
  client = fake;
  enabled = Boolean(fake);
};
