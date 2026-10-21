// One safe response reader for every API call.
//
// The API contract is JSON, but platforms (Vercel) answer with plain text such
// as "An error occurred..." when a function is killed. Calling res.json() on
// that text is what produced "Unexpected token 'A', ... is not valid JSON".
// Nothing in the UI should ever surface a parser error: readJson checks the
// status and Content-Type first, then throws a typed error with a friendly
// message plus the request id.

const JSON_TYPE = /application\/(?:[\w.+-]+\+)?json/i;

export const hasJsonContentType = (res) => {
  const contentType = res?.headers?.get?.('content-type') || '';
  return JSON_TYPE.test(contentType);
};

export const requestIdFrom = (res, body) =>
  body?.error?.requestId ||
  body?.requestId ||
  body?.meta?.requestId ||
  res?.headers?.get?.('x-request-id') ||
  null;

const friendlyFor = (status, code, fallback) => {
  if (code === 'AI_TIMEOUT') {
    return 'The AI chef took too long to answer. Please try again.';
  }
  if (code === 'AI_UNAVAILABLE') {
    return 'The AI chef is unavailable right now. Please try again in a moment.';
  }
  if (status >= 500) {
    return 'The server had a problem completing that request. Please try again.';
  }
  if (status === 0) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  return fallback;
};

export class ApiClientError extends Error {
  constructor({
    status = 0,
    code = 'REQUEST_FAILED',
    requestId = null,
    message = 'Something went wrong. Please try again.',
    retryable = true,
    cause,
  } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
    if (cause) this.cause = cause;
  }

  // What the UI renders: friendly text, never a parser/platform message.
  get userMessage() {
    return this.requestId
      ? `${this.message} (Request ID: ${this.requestId})`
      : this.message;
  }
}

export const toApiClientError = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err instanceof ApiClientError) return err;
  return new ApiClientError({ message: fallback, cause: err });
};

/**
 * Read a fetch Response as JSON, safely.
 * - non-JSON or unparseable 2xx → typed BAD_RESPONSE (friendly, retryable)
 * - 5xx → typed error with friendly text + request id (server prose hidden)
 * - 4xx JSON → server's message/code (validation feedback stays useful)
 */
export const readJson = async (res, { fallbackMessage = 'Something went wrong. Please try again.' } = {}) => {
  if (!res) {
    throw new ApiClientError({ message: fallbackMessage });
  }

  const status = res.status ?? 0;
  const isJson = hasJsonContentType(res);
  let body = null;

  if (isJson) {
    try {
      body = await res.json();
    } catch (cause) {
      // Declared JSON but truncated/invalid: still never leak the parser text.
      throw new ApiClientError({
        status,
        code: 'BAD_RESPONSE',
        requestId: requestIdFrom(res, null),
        message: friendlyFor(status >= 500 ? status : 0, null, fallbackMessage),
        cause,
      });
    }
  }

  const requestId = requestIdFrom(res, body);

  if (!res.ok) {
    const code = body?.error?.code || (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED');
    const serverMessage = body?.error?.message;
    const message = status < 500 && serverMessage
      ? serverMessage
      : friendlyFor(status, code, fallbackMessage);
    throw new ApiClientError({
      status,
      code,
      requestId,
      message,
      retryable: status >= 500 || code === 'AI_TIMEOUT' || code === 'AI_UNAVAILABLE',
    });
  }

  if (!isJson) {
    // 200 with HTML/plain text (proxy page, misrouted rewrite, platform body).
    throw new ApiClientError({
      status,
      code: 'BAD_RESPONSE',
      requestId,
      message: 'The server sent an unexpected response. Please try again.',
    });
  }

  return body;
};

/**
 * fetch + readJson. Network failures become ApiClientError with a friendly
 * message, so callers only ever see one error type.
 */
export const apiFetchJson = async (url, options = {}, readOptions = {}) => {
  let res;
  try {
    res = await fetch(url, options);
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiClientError({
      message: readOptions.fallbackMessage || 'We could not reach the server. Check your connection and try again.',
      cause,
    });
  }
  return readJson(res, readOptions);
};

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err instanceof ApiClientError) return err.userMessage;
  // Never let a parser/network/TypeError string reach the UI. Errors our own
  // code threw deliberately (plain Error) stay readable.
  if (err instanceof Error && !['SyntaxError', 'TypeError'].includes(err.name)) {
    return err.message || fallback;
  }
  return fallback;
};
