import { env } from './env.js';
import { app } from './app.js';
import { logger } from './lib/logger.js';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'NaijaTaste AI listening');
});

// Graceful shutdown — stop accepting, let in-flight finish, then exit
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutdown requested');
  server.close(() => {
    logger.info({ signal }, 'shutdown complete');
    process.exit(0);
  });
  // Bounded drain: force-exit if keep-alive connections hang past 10s
  setTimeout(() => {
    logger.warn({ signal }, 'shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  shutdown('uncaughtException');
});
