import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  // Default model: gemini-3.5-flash-lite answered in ~0.6s on 2026-10-20,
  // while gemini-3.8-flash hung past 30s (probes/gemini-probe.mjs). The
  // llm.service model chain degrades to the next model automatically.
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  // Hard ceiling for ALL Gemini attempts + backoff in one request. Kept well
  // below vercel.json maxDuration (60s) so Express can still answer with JSON
  // and so the cold start (~5s) fits inside the platform budget.
  // Measured against the real prompts (probes/gemini-prompt-latency.mjs):
  // the slowest healthy call is ~18s, so the ceiling must allow one full
  // success plus one fallback attempt.
  GEMINI_TOTAL_TIMEOUT_MS: z.coerce.number().int().positive().default(35000),
  // Ceiling for a single attempt; the total budget always wins.
  GEMINI_ATTEMPT_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
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
  // Auth limits are per client IP. They are deliberately generous because
  // Nigerian carriers put whole neighbourhoods behind one address; the
  // precise control is the per-(email, ip) lockout in src/auth/lockout.js.
  AUTH_RATE_LIMIT_SIGNUP_MAX: z.coerce.number().int().positive().default(25),
  AUTH_RATE_LIMIT_SIGNIN_MAX: z.coerce.number().int().positive().default(50),
  AUTH_RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_GOOGLE_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_FORGOT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_RESET_MAX: z.coerce.number().int().positive().default(20),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_DIRECT: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  DEV_OTP_ENABLED: z.enum(['true', 'false']).default('false'),
  // Error tracking: set to enable; unset = monitoring is a quiet no-op.
  SENTRY_DSN: z.string().optional(),
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
