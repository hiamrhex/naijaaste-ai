import pino from 'pino';
import { env } from '../env.js';

// Exported for tests: the exact paths the singleton redacts.
export const REDACT_PATHS = [
  'apiKey',
  'GEMINI_API_KEY',
  '*.apiKey',
  'otp',
  '*.otp',
  'dev_otp',
  '*.dev_otp',
  'password',
  '*.password',
  'new_password',
  '*.new_password',
  'credential',
  '*.credential',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'SMTP_PASS',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.new_password',
  'req.body.credential',
];

export const logger = pino({
  name: 'naijataste-ai',
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
});
