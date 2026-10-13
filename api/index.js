// Vercel serverless entry — imports the Express app WITHOUT calling listen
// (listen lives in src/server.js for local/production-long-running only).
// An Express app is a (req, res) handler, so it is a valid function export.
//
// Same-origin: vercel.json rewrites /api/* to this function, so the
// frontend calls /api/auth/… — strip that mount prefix back to the paths
// Express actually serves (/auth/…, /api/v1/…). Local dev is unaffected
// (requests there never carry the /api prefix).
import { app } from '../src/app.js';

export default (req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }
  return app(req, res);
};
