// A JSON body parser that does not assume `req` is a readable stream.
//
// Why this exists: express.json() (body-parser) reads the body with
// `req.on('data')` / `for await`. On the Vercel serverless runtime the
// handler can receive a request whose body has already been consumed by the
// platform, and `req` is then not a stream at all. body-parser throws
// "stream.on is not a function" — a TypeError with no `status` — and because
// it happens before src/middleware/requestId.js, Express jumps straight to
// the error handler: every POST with a JSON body answered
//   500 {"error":{"code":"INTERNAL"}}   with no X-Request-Id,
// while GETs and non-JSON bodies worked. Measured live on 2026-10-21.
//
// This parser handles every shape the body can arrive in:
//   - already-parsed object      (req.body is an object)
//   - Buffer or string           (req.body is a Buffer/string)
//   - a readable stream          (the normal case)
// and never throws a status-less error: malformed JSON is a 400, an
// oversized body is a 413, and everything else is a normal JSON object.

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

// Set req.body without assuming it is a writable property.
//
// The Vercel runtime exposes `body` on its request object as a READ-ONLY
// accessor (the raw body as a Buffer/string). A plain assignment to it throws
// "Cannot set property body of #<IncomingMessage> which has only a getter" -
// a TypeError with no status, which Express reports as a bare 500. So:
//   1. a writable data property / accessor with a setter -> assign
//   2. otherwise -> shadow it with an own data property (this also covers an
//      accessor inherited from the request's prototype, which is why the
//      shadowing is tried before the assignment)
const setBody = (req, value) => {
  const desc = Object.getOwnPropertyDescriptor(req, 'body');
  if (desc && (desc.writable || desc.set)) {
    try {
      req.body = value;
      return true;
    } catch { /* fall through to shadowing */ }
  }
  try {
    Object.defineProperty(req, 'body', {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return true;
  } catch { /* the own property is not configurable */ }
  try {
    req.body = value;
    return true;
  } catch {
    return false;
  }
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
  return Buffer.concat(chunks).toString('utf8');
};

export const jsonBody = ({ limit = DEFAULT_LIMIT_BYTES } = {}) => async (req, res, next) => {
  if (req._body) return next();

  // Only JSON is parsed; every other content type is left alone.
  if (!isJsonType(req)) return next();

  if (!hasBody(req)) {
    req.body = {};
    return next();
  }

  try {
    const provided = req.body;

    // 1. The platform already parsed it.
    if (provided && typeof provided === 'object' && !Buffer.isBuffer(provided)) {
      req._body = true;
      return next();
    }

    // 2. The platform buffered it (a Buffer or a string).
    if (Buffer.isBuffer(provided) || typeof provided === 'string') {
      if (provided.length > limit) throw parseError('entity.too.large');
      const parsed = provided.length ? JSON.parse(provided.toString('utf8')) : {};
      if (!setBody(req, parsed)) {
        // The accessor is not replaceable: keep the parsed body where the
        // routes can reach it.
        req.parsedBody = parsed;
      }
      req._body = true;
      return next();
    }

    // 3. The normal case: a readable stream.
    if (typeof req.on === 'function' || typeof req[Symbol.asyncIterator] === 'function') {
      const raw = await readStream(req, limit);
      const parsed = raw.length ? JSON.parse(raw) : {};
      if (!setBody(req, parsed)) req.parsedBody = parsed;
      req._body = true;
      return next();
    }

    // 4. Nothing to read.
    if (!setBody(req, {})) req.parsedBody = {};
    req._body = true;
    return next();
  } catch (err) {
    if (err instanceof SyntaxError) return next(parseError('entity.parse.failed'));
    if (err?.type === 'entity.too.large') return next(err);
    return next(err);
  }
};

export const JSON_BODY_LIMIT_BYTES = DEFAULT_LIMIT_BYTES;
