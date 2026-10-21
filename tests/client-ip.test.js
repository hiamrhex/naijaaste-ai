import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from '../src/middleware/requestId.js';
import { jsonBody } from '../src/middleware/jsonBody.js';
import { clientIp, readClientIp } from '../src/lib/clientIp.js';

// The Vercel serverless runtime nulls req.socket once the request body has
// been read. Every later req.ip read then throws
//   TypeError: Cannot read properties of null (reading 'remoteAddress')
// which Express turned into a bare 500 - and that killed every POST with a
// body (signup, sign-in, chat) on the live deployment.
//
// These tests reproduce that runtime and prove the API survives it.

const buildRuntimeApp = (handler) => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(jsonBody());
  // The runtime: the socket disappears once the body has been consumed.
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'socket', { value: null, configurable: true });
    next();
  });
  app.post('/probe', (req, res) => handler(req, res));
  return app;
};

describe('the client IP survives a runtime without a socket', () => {
  it('readClientIp falls back instead of throwing when the socket is gone', () => {
    const req = { ip: undefined, socket: null, connection: null };
    expect(() => readClientIp(req)).not.toThrow();
    expect(readClientIp(req)).toBe('unknown');
  });

  it('clientIp prefers the value captured before the body was read', () => {
    const req = { clientIp: '203.0.113.7', ip: undefined, socket: null };
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('the requestId middleware captures the IP before the body is read', async () => {
    const app = buildRuntimeApp((req, res) => res.json({ captured: req.clientIp }));
    const res = await request(app)
      .post('/probe')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ a: 1 })
      .expect(200);
    // Either the forwarded address or the socket address, but never a throw.
    expect(typeof res.body.captured).toBe('string');
    expect(res.body.captured.length).toBeGreaterThan(0);
  });

  it('a route that reads req.ip after the body is parsed would throw - the captured one does not', async () => {
    const app = buildRuntimeApp((req, res) => {
      // This is what the old code did: read req.ip after the body was read.
      let wouldThrow = false;
      try { void req.ip; } catch { wouldThrow = true; }
      res.json({ wouldThrow, captured: req.clientIp });
    });
    const res = await request(app).post('/probe').send({ a: 1 }).expect(200);
    expect(res.body.wouldThrow).toBe(true);   // the runtime really is hostile
    expect(res.body.captured).toBeTruthy();   // and we do not rely on it
  });

  it('the body still parses on a request with no socket', async () => {
    const app = buildRuntimeApp((req, res) => res.json({ body: req.body }));
    const res = await request(app).post('/probe').send({ a: 1 }).expect(200);
    expect(res.body.body).toEqual({ a: 1 });
  });
});
