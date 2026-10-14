import { ApiError } from '../lib/errors.js';
import { fail } from '../lib/respond.js';
import { logger } from '../lib/logger.js';

export const errorHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let details;
  let retryAfterSec;

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
    retryAfterSec = err.retryAfterSec;
  } else if (err?.type === 'entity.too.large') {
    // Body-parser limit (10kb global, 350kb on /reports): a client payload
    // problem, never an upstream failure. Surfaced honestly as 413.
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body exceeds the size limit for this endpoint';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Malformed JSON body';
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

  fail(res, { status, code, message, details, requestId: req.id, retryAfterSec });
};
