import pino from 'pino';
import { env } from '../env.js';

export const logger = pino({
  name: 'naijataste-ai',
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'apiKey',
      'GEMINI_API_KEY',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});
