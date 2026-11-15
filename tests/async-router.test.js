import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { asyncRouter } from '../src/lib/async-router.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// Express 4 does not route a rejected promise to the error handler. Before
// this, an async handler that threw (a Neon blip on GET /auth/favorites, a NUL
// byte on POST /reports) wrote no response at all: the client hung until the
// platform timeout and got a plain-text 504 with no requestId.

const buildApp = () => {
  const app = express();
  app.use((req, _res, next) => {
    req.id = 'test-request-id';
    next();
  });
  const router = asyncRouter();
  router.get('/boom', async () => {
    throw new Error('database went away');
  });
  router.get('/fine', async (_req, res) => res.json({ ok: true }));
  app.use(router);
  app.use(errorHandler);
  return app;
};

describe('asyncRouter', () => {
  it('turns a rejected async handler into a JSON error, not a hang', async () => {
    const res = await request(buildApp()).get('/boom').expect(500);

    expect(res.body).toMatchObject({
      error: { code: 'INTERNAL' },
    });
    expect(res.body.error.requestId).toBe('test-request-id');
    // The internal message must never reach the client.
    expect(JSON.stringify(res.body)).not.toContain('database went away');
  });

  it('leaves successful handlers untouched', async () => {
    await request(buildApp()).get('/fine').expect(200, { ok: true });
  });
});

describe('route modules use the wrapper', () => {
  const routesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'routes');

  it('no route file imports Router from express directly', () => {
    // A plain Router() reintroduces the hang for every async handler in that
    // file, which is exactly how the defect would come back.
    const offenders = readdirSync(routesDir)
      .filter((f) => f.endsWith('.js'))
      .filter((f) => /import \{ Router \} from 'express'/.test(readFileSync(join(routesDir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
