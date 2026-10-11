import pino from 'pino';

export const logger = pino({
  name: 'naijataste-ai',
  level: process.env.LOG_LEVEL || 'info',
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
