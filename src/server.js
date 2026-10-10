import { app } from './app.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`NaijaTaste AI listening on port ${PORT}`);
});

// Graceful shutdown — stop accepting, let in-flight finish, then exit
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — draining connections`);
  server.close(() => {
    console.log('[shutdown] server closed cleanly');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[shutdown] forced exit after 10s drain timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err.message);
  shutdown('uncaughtException');
});
