import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { requestId } from '../src/middleware/requestId.js';
import { logger } from '../src/lib/logger.js';
import { sendOtpEmail } from '../src/services/email.service.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logging (layers 21/22/23)', () => {
  it('every response carries X-Request-Id', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('rejects malformed inbound ids, generates its own', async () => {
    const res = await request(app)
      .get('/health')
      .set('X-Request-Id', 'bad id with spaces and <tags>')
      .expect(200);
    expect(res.headers['x-request-id']).not.toContain(' ');
  });

  it('attaches req.log child logger with the same id', async () => {
    let captured = null;
    const mw = (req, _res, next) => {
      captured = { id: req.id, hasLog: typeof req.log?.info === 'function' };
      next();
    };
    const { default: express } = await import('express');
    const probe = express();
    probe.use(requestId);
    probe.use(mw);
    probe.get('/probe', (_req, res) => res.json({ ok: true }));
    await request(probe).get('/probe').set('X-Request-Id', 'probe-id-12345').expect(200);
    expect(captured).toEqual({ id: 'probe-id-12345', hasLog: true });
  });

  it('logger exports a pino instance with info level', () => {
    expect(typeof logger.child).toBe('function');
    expect(logger.level).toBe(process.env.LOG_LEVEL || 'info');
  });

  it('dev otp fallback logs no recipient or code (plan 009)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await sendOtpEmail({ to: 'someone@example.com', name: 'Someone', code: '123456' });
    expect(warn).toHaveBeenCalled();
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain('someone@example.com');
    expect(logged).not.toContain('123456');
  });

  it('pino redaction covers auth-secret shapes (plan 009)', async () => {
    const { default: pino } = await import('pino');
    const { REDACT_PATHS } = await import('../src/lib/logger.js');
    const chunks = [];
    const mem = { write: (c) => { chunks.push(String(c)); return true; } };
    const probe = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, mem);
    probe.info({
      otp: '111111', dev_otp: '222222', password: 's3cret',
      credential: 'cred-value', accessToken: 'tok-abc',
      nested: { refreshToken: 'tok-def' },
    }, 'redact check');
    const out = chunks.join('');
    for (const secret of ['111111', '222222', 's3cret', 'cred-value', 'tok-abc', 'tok-def']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
  });
});
