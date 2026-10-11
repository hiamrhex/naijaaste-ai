import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export const requestId = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id });

  const start = Date.now();
  res.on('finish', () => {
    req.log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
      },
      'request completed'
    );
  });

  next();
};
