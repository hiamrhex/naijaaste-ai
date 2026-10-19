// Monitoring hook — error tracking is opt-in via SENTRY_DSN.
// No DSN → everything here is a no-op (tests and local dev stay quiet).
// Redaction: request cookies, authorization headers and auth-shaped body
// fields are stripped before anything leaves the process.
import { env } from '../env.js';

let client = null;
let enabled = false;

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

const SENSITIVE_BODY_KEYS = /^(password|token|access_?token|refresh_?token|otp|code|secret)$/i;
// Personal data beyond auth material: email addresses never leave the process.
const EMAIL_BODY_KEYS = /e[-_]?mail/i;

export const redactEvent = (event) => {
  if (!event?.request) return event;
  if (event.request.headers) event.request.headers = redactHeaders(event.request.headers);
  if (event.request.cookies) delete event.request.cookies;
  if (event.request.data && typeof event.request.data === 'object') {
    const cleanNode = (node) => {
      for (const key of Object.keys(node)) {
        if (SENSITIVE_BODY_KEYS.test(key) || EMAIL_BODY_KEYS.test(key)) {
          node[key] = SENSITIVE_BODY_KEYS.test(key) ? '[REDACTED]' : '[REDACTED_EMAIL]';
        } else if (node[key] && typeof node[key] === 'object') {
          cleanNode(node[key]);
        }
      }
    };
    cleanNode(event.request.data);
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
      tags: context.tags,
      extra: context.extra,
    });
  } catch { /* swallow — monitoring never breaks the request */ }
};

export const monitoringEnabled = () => enabled;
