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

    // 2. The platform buffered it.
    if (Buffer.isBuffer(provided) || typeof provided === 'string') {
      if (provided.length > limit) throw parseError('entity.too.large');
      req.body = provided.length ? JSON.parse(provided.toString('utf8')) : {};
      req._body = true;
      return next();
    }

    // 3. The normal case: a readable stream.
    if (typeof req.on === 'function' || typeof req[Symbol.asyncIterator] === 'function') {
      const raw = await readStream(req, limit);
      req.body = raw.length ? JSON.parse(raw) : {};
      req._body = true;
      return next();
    }

    // 4. Nothing to read.
    req.body = {};
    req._body = true;
    return next();
  } catch (err) {
    if (err instanceof SyntaxError) return next(parseError('entity.parse.failed'));
    if (err?.type === 'entity.too.large') return next(err);
    return next(err);
  }
};

export const JSON_BODY_LIMIT_BYTES = DEFAULT_LIMIT_BYTES;
