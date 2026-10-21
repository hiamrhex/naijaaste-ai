// The client IP, captured safely.
//
// `req.ip` is derived from `req.socket.remoteAddress` (through
// proxy-addr and the trust-proxy setting). On the Vercel serverless runtime
// the socket is nulled as soon as the request body has been read, so every
// `req.ip` read AFTER body parsing throws
//   TypeError: Cannot read properties of null (reading 'remoteAddress')
// which Express reported as a bare 500 - and that killed every POST with a
// body (signup, sign-in, chat) on the live deployment.
//
// The IP therefore has to be read while the socket is still alive: the
// requestId middleware runs before the body parser and stores it on
// `req.clientIp`. Everything else uses that value.

export const readClientIp = (req) => {
  try {
    if (req?.ip) return req.ip;
  } catch { /* the socket is gone - fall through */ }
  try {
    return (
      req?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
};

/** The captured IP, or a safe fallback. Never throws. */
export const clientIp = (req) => {
  if (req?.clientIp) return req.clientIp;
  return readClientIp(req);
};
