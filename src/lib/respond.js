// Layer 20 + 26 — the only two response shapes in the API.
// Success: { data, meta? }            (layer 26)
// Failure: { error: { code, message, details?, requestId } }  (layer 20)
// Every route and middleware must use these; nothing hand-rolls bodies.
export const ok = (res, data, meta, status = 200) => {
  const body = { data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
};

export const fail = (res, { status, code, message, details, requestId, retryAfterSec }) => {
  if (retryAfterSec) res.set('Retry-After', String(retryAfterSec));
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  });
};
