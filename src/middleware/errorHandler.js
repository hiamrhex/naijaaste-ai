import { ApiError } from '../lib/errors.js';
import { fail } from '../lib/respond.js';
import { logger } from '../lib/logger.js';
import { captureException } from '../lib/monitoring.js';

// TEMPORARY diagnostic (2026-10-21): the Vercel runtime failed every POST
// with a JSON body, and the error class was invisible from outside. It is
// reported for 5xx only, and only the error class/message of a programming
// error (no user data). Remove once the runtime behaviour is confirmed.
const DEBUG_5XX = true;

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
  } else if (err?.code === 'LLM_TIMEOUT') {
    // Raised by llm.service before any platform kill: always a typed 504 so
    // the client can show a friendly retry (never INTERNAL / plain text).
    status = 504;
    code = 'AI_TIMEOUT';
    message = 'The AI service took too long to respond. Please try again.';
  } else if (err?.code === 'LLM_UNAVAILABLE') {
    status = 503;
    code = 'AI_UNAVAILABLE';
    message = 'The AI service is unavailable right now. Please try again in a moment.';
  } else if (err?.code === 'CIRCUIT_OPEN') {
    status = 503;
    code = 'AI_UNAVAILABLE';
    message = 'The AI service is unavailable right now. Please try again in a moment.';
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
    // TEMPORARY: the first bytes that arrived, to identify the runtime's
    // body framing.
    if (DEBUG_5XX && err.body_preview) details = err.body_preview;
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
    // Server errors (never 4xx client noise) reach error tracking with a
    // request id, so a Sentry event joins the log line it came from.
    captureException(err, {
      tags: { requestId: req.id, code, path: req.originalUrl },
      extra: { serviceName: req.log?.bindings?.name },
    });
  }

  // TEMPORARY (see DEBUG_5XX above): expose the error class of a 5xx so the
  // runtime-specific failure can be identified from a live probe.
  const debug = DEBUG_5XX && status >= 500 && err?.name
    ? {
      error_debug: {
        name: err.name,
        message: String(err.message || '').slice(0, 200),
        ...(err.stack ? { stack: String(err.stack).split('\n').slice(1, 5).join(' | ').slice(0, 600) } : {}),
        ...(err.runtime_diagnostic ? { runtime: err.runtime_diagnostic } : {}),
      },
    }
    : {};

  fail(res, { status, code, message, details, requestId: req.id, retryAfterSec, ...debug });
};
