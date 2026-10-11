import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const errorHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (typeof err?.status === 'number') {
    // LLM SDK errors (GoogleGenAI ApiError) carry .status — anything unexpected
    // from the LLM upstream is a 502, never a leak of the SDK message.
    status = 502;
    code = 'UPSTREAM_FAILURE';
    message = 'Upstream LLM request failed';
  }

  if (status >= 500) {
    const log = req.log || logger;
    log.error({ err }, 'unhandled error');
  }

  res.status(status).json({
    success: false,
    error: { code, message },
    ...(details ? { details } : {}),
    ...(req.id ? { requestId: req.id } : {}),
  });
};
