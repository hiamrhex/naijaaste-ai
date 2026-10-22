// A JSON body parser for a runtime whose request object cannot be trusted.
//
// The Vercel serverless runtime exposes `body` on the request as an own
// property with a getter AND a setter, and that accessor parses the body
// itself: reading it throws `Error: Invalid JSON`, and assigning to it
// throws the same. body-parser (express.json()) assumes a readable stream
// and a plain writable `req.body`, so on that runtime it either threw
// "stream.on is not a function" or, once it did read the body, our own
// assignment hit the platform's throwing setter.
//
// Measured on the live deployment (2026-10-21):
//   own_body: { writable: false, has_get: true, has_set: true, configurable: true }
//   is_stream: true, readable: true, readable_ended: false
//   content-type: application/json, content-length: 5
// Every POST with a JSON body answered 500 INTERNAL without a request id.
//
// The parser therefore:
//   1. reads the raw bytes from the STREAM (which the runtime leaves intact),
//   2. parses them itself,
//   3. attaches the result with Object.defineProperty, which shadows the
//      platform's accessor without ever calling its getter or setter.
//
// It never throws a status-less error: malformed JSON is a 400, an oversized
// body is a 413, and everything else is a normal JSON object.

const DEFAULT_LIMIT_BYTES = 10 * 1024; // matches the previous express.json limit

const isJsonType = (req) => {
  const type = req.headers?.['content-type'];
  if (!type) return false;
  const mime = String(type).split(';')[0].trim().toLowerCase();
  return mime === 'application/json';
};

const hasBody = (req) =>
  req.headers?.['transfer-encoding'] !== undefined ||
  (req.headers?.['content-length'] !== undefined &&
    !Number.isNaN(Number(req.headers['content-length'])));

const parseError = (type) => {
  const err = new Error(type === 'entity.too.large'
    ? 'Request body exceeds the size limit'
    : 'Malformed JSON body');
  err.type = type;
  err.status = type === 'entity.too.large' ? 413 : 400;
  err.statusCode = err.status;
  return err;
};

const readStream = async (req, limit) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buf.length;
    if (size > limit) throw parseError('entity.too.large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
};

// The platform's own copy of the body, if it has one. Reading it can throw
// on this runtime, so it is best-effort and never fatal.
const platformBody = (req) => {
  try {
    const provided = req.body;
    if (Buffer.isBuffer(provided)) return provided;
    if (typeof provided === 'string') return Buffer.from(provided, 'utf8');
    if (provided && typeof provided === 'object') return Buffer.from(JSON.stringify(provided), 'utf8');
  } catch { /* the accessor throws on this runtime */ }
  return Buffer.alloc(0);
};

/**
 * Attach the parsed body to the request.
 * defineProperty first: it shadows the platform's accessor without calling
 * its getter or setter, and the property is configurable.
 */
const setBody = (req, value) => {
  try {
    Object.defineProperty(req, 'body', {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return true;
  } catch { /* not configurable - fall through */ }
  try {
    req.body = value;
    return true;
  } catch {
    return false;
  }
};

export const jsonBody = ({ limit = DEFAULT_LIMIT_BYTES } = {}) => async (req, res, next) => {
  if (req._body) return next();

  // Only JSON is parsed; every other content type is left alone.
  if (!isJsonType(req)) return next();

  if (!hasBody(req)) {
    if (!setBody(req, {})) req.parsedBody = {};
    req._body = true;
    return next();
  }

  try {
    let raw = Buffer.alloc(0);
    // 1. The stream: the runtime leaves it intact even though its `body`
    //    accessor is broken.
    if (typeof req[Symbol.asyncIterator] === 'function' || typeof req.on === 'function') {
      try {
        raw = await readStream(req, limit);
      } catch (err) {
        if (err?.type === 'entity.too.large') throw err;
        raw = Buffer.alloc(0);
      }
    }
    // 2. Fall back to the platform's copy when the stream yielded nothing.
    if (!raw.length) raw = platformBody(req);
    if (raw.length > limit) throw parseError('entity.too.large');

    let parsed = {};
    if (raw.length) {
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch (err) {
        if (err instanceof SyntaxError) throw parseError('entity.parse.failed');
        throw err;
      }
    }

    if (!setBody(req, parsed)) {
      // The request refuses a plain `body` property: keep the parsed body
      // where the routes can still reach it.
      req.parsedBody = parsed;
    }
    req._body = true;
    return next();
  } catch (err) {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') return next(err);
    return next(err);
  }
};

export const JSON_BODY_LIMIT_BYTES = DEFAULT_LIMIT_BYTES;
