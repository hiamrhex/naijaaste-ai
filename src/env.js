import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_LLM_MAX: z.coerce.number().int().positive().default(10),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_DIRECT: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  DEV_OTP_ENABLED: z.enum(['true', 'false']).default('false'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with field names only — never echo values (they may be secrets).
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && !parsed.data.CORS_ORIGIN) {
  // Plan 011: an empty allowlist reflects any origin with credentials —
  // refuse to boot open in production; dev/test keep the convenience.
  console.error('Invalid environment configuration:');
  console.error('  - CORS_ORIGIN: required in production (comma-separated allowed origins)');
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && !parsed.data.DATABASE_URL) {
  // JSON stores are gone: production without a database would silently run
  // on ephemeral pg-mem and lose every write on restart. Refuse to boot.
  console.error('Invalid environment configuration:');
  console.error('  - DATABASE_URL: required in production (Neon pooled URL for runtime)');
  process.exit(1);
}

export const env = parsed.data;
