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
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const asyncRouter = (options) => {
  const router = Router(options);
  for (const method of METHODS) {
    const register = router[method].bind(router);
    router[method] = (...args) =>
      register(...args.map((arg) => (typeof arg === 'function' && arg.length < 4 ? wrap(arg) : arg)));
  }
  return router;
};
