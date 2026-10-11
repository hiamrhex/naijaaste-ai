import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { requestId } from '../src/middleware/requestId.js';
import { logger } from '../src/lib/logger.js';

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
});
