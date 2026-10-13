import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';

// Plan 011: production without CORS_ORIGIN refuses to boot (fail-closed);
// dev without it still boots (convenience preserved).
const BASE_ENV = {
  ...process.env,
  GEMINI_API_KEY: 'test-key-not-real',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'test-refresh-secret-fedcba9876543210',
  DEV_OTP_ENABLED: 'false',
};

const runEnv = (extra) => {
  try {
    execFileSync(process.execPath, ['-e', "import('./src/env.js')"], {
      cwd: process.cwd(),
      env: { ...BASE_ENV, ...extra },
      stdio: 'pipe',
    });
    return { status: 0, stderr: '' };
  } catch (e) {
    return { status: e.status, stderr: String(e.stderr) };
  }
};

describe('CORS production guard (plan 011)', () => {
  it('production without CORS_ORIGIN exits 1 naming the field, leaking no values', () => {
    const { CORS_ORIGIN: _drop, ...noCors } = BASE_ENV;
    const r = runEnv({ ...noCors, NODE_ENV: 'production' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('CORS_ORIGIN');
    expect(r.stderr).not.toContain('test-key-not-real');
    expect(r.stderr).not.toContain('test-access-secret');
  });

  it('production with CORS_ORIGIN boots', () => {
    const r = runEnv({ NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com' });
    expect(r.status).toBe(0);
  });

  it('development without CORS_ORIGIN still boots', () => {
    const { CORS_ORIGIN: _drop, ...noCors } = BASE_ENV;
    const r = runEnv({ ...noCors, NODE_ENV: 'development' });
    expect(r.status).toBe(0);
  });
});
