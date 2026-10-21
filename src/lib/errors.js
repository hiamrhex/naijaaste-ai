export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details; // optional: array of { path, message }
  }
}

// Layer 19 — typed hierarchy. Throw the specific subclass; the global
// errorHandler maps it to the unified shape (layer 20) + status (layer 27).
export class ValidationError extends ApiError {
  constructor(message, details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(code = 'NOT_FOUND', message = 'Not found') {
    super(404, code, message);
  }
}

export class ConflictError extends ApiError {
  constructor(code = 'CONFLICT', message = 'Conflict') {
    super(409, code, message);
  }
}

export class RateLimitedError extends ApiError {
  constructor(message = 'Too many requests, please try again later.', retryAfterSec) {
    super(429, 'RATE_LIMITED', message);
    this.retryAfterSec = retryAfterSec;
  }
}

export class UpstreamError extends ApiError {
  constructor(message = 'Upstream request failed') {
    super(502, 'UPSTREAM_FAILURE', message);
  }
}

export class UnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable', code = 'UNAVAILABLE') {
    super(503, code, message);
  }
}

// The model did not answer inside our own budget. 504 so clients can tell a
// slow upstream apart from a hard outage (503) and retry with backoff.
export class AiTimeoutError extends ApiError {
  constructor(message = 'The AI service took too long to respond. Please try again.') {
    super(504, 'AI_TIMEOUT', message);
  }
}

// Circuit open / provider 5xx / throttled: the AI path is unavailable.
export class AiUnavailableError extends ApiError {
  constructor(message = 'The AI service is unavailable right now. Please try again in a moment.') {
    super(503, 'AI_UNAVAILABLE', message);
  }
}

export const badRequest = (message, details) =>
  new ValidationError(message, details);

export const notFound = (code, message) => new NotFoundError(code, message);

export const isApiError = (err) => err instanceof ApiError;
