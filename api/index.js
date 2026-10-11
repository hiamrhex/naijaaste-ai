// Vercel serverless entry — imports the Express app WITHOUT calling listen
// (listen lives in src/server.js for local/production-long-running only).
// An Express app is a (req, res) handler, so it is a valid function export.
import { app } from '../src/app.js';

export default app;
