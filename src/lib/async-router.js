import { Router } from 'express';

// Express 4 does not forward a rejected promise to the error handler. An async
// handler that throws therefore never calls next(), so no response is ever
// written: the client hangs until the platform kills the request (Vercel's
// maxDuration) and gets a plain-text 504 with no requestId, while errorHandler
// and captureException never run.
//
// Wrapping every handler at the router level fixes the whole class instead of
// relying on each author to remember try/catch. Handlers that already catch
// keep working unchanged.

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

// A function with four declared parameters is an error middleware; Express
// must see its real arity, so it is left untouched.
//
// The wrapper keeps the original function name. Express exposes it as
// `handler.name`, and the route-inventory gate uses that to prove that every
// user-scoped route carries `requireAuth`/`requireAdmin`. Renaming every guard
// to "anonymous" made the gate pass vacuously.
const wrap = (fn) => {
  const wrapped = (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  if (fn.name) Object.defineProperty(wrapped, 'name', { value: fn.name });
  return wrapped;
};
export const asyncRouter = (options) => {
  const router = Router(options);
  for (const method of METHODS) {
    const register = router[method].bind(router);
    router[method] = (...args) =>
      register(...args.map((arg) => (typeof arg === 'function' && arg.length < 4 ? wrap(arg) : arg)));
  }
  return router;
};
