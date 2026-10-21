import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';
import { getDbTiming } from '../lib/dbTiming.js';
import { readClientIp } from '../lib/clientIp.js';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export const requestId = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id });

  // Capture the client IP NOW: the runtime nulls req.socket once the body has
  // been read, and every later req.ip read would throw (see lib/clientIp.js).
  req.clientIp = readClientIp(req);

  // Express's req.ip / req.ips getters dereference req.socket, which the
  // serverless runtime nulls. Replace them with safe versions that return
  // the captured address: a third-party middleware (express-rate-limit reads
  // request.ip for a debug log on every request) would otherwise throw a
  // TypeError and turn the request into a bare 500.
  try {
    Object.defineProperty(req, 'ip', {
      configurable: true,
      enumerable: true,
      get: () => req.clientIp ?? 'unknown',
    });
    Object.defineProperty(req, 'ips', {
      configurable: true,
      enumerable: true,
      get: () => [req.clientIp ?? 'unknown'],
    });
  } catch { /* the request object refuses new accessors - the captured value still works */ }

  const start = Date.now();
  // Uptime at the START of this request is the honest cold-start marker: if
  // the function just booted it is small even when the Neon wake-up dominates.
  const coldStartMs = Math.round(process.uptime() * 1000);
  res.on('finish', () => {
    // Timing was captured during this request (getPool runs lazily), so the
    // cold start and Neon wake-up appear on the same line as the request.
    const db = getDbTiming();
    req.log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        cold_start_ms: coldStartMs,
        db_wake_ms: db.wakeMs,
        db_init_ms: db.initMs,
      },
      'request completed'
    );
  });

  next();
};
