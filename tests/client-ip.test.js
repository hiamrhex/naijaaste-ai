import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
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

  it('req.ip no longer throws after the body was parsed', async () => {
    const app = buildRuntimeApp((req, res) => {
      // This is what the old code did: read req.ip after the body was read.
      // On the serverless runtime that threw
      //   TypeError: Cannot read properties of null (reading 'remoteAddress')
      let threw = null;
      let ip = null;
      try { ip = req.ip; } catch (err) { threw = err.message; }
      res.json({ threw, ip, captured: req.clientIp });
    });
    const res = await request(app)
      .post('/probe')
      .set('X-Forwarded-For', '203.0.113.5')
      .send({ a: 1 })
      .expect(200);
    expect(res.body.threw).toBeNull();     // the runtime is hostile, we are not
    expect(res.body.ip).toBe('203.0.113.5');
    expect(res.body.captured).toBe('203.0.113.5');
  });

  it('the body still parses on a request with no socket', async () => {
    const app = buildRuntimeApp((req, res) => res.json({ body: req.body }));
    const res = await request(app).post('/probe').send({ a: 1 }).expect(200);
    expect(res.body.body).toEqual({ a: 1 });
  });

  it('req.ip and req.ips are safe once the socket is gone', async () => {
    const app = buildRuntimeApp((req, res) => res.json({ ip: req.ip, ips: req.ips }));
    const res = await request(app)
      .post('/probe')
      .set('X-Forwarded-For', '203.0.113.11')
      .send({ a: 1 })
      .expect(200);
    expect(res.body.ip).toBe('203.0.113.11');
    expect(res.body.ips).toEqual(['203.0.113.11']);
  });

  it('a rate limiter that reads req.ip does not break the request', async () => {
    // express-rate-limit v8.7.1 evaluates `request.ip` for a debug log on
    // every request (dist/index.mjs:875) - the argument is evaluated even
    // when debug logging is off, so an unsafe req.ip turns every request
    // into a 500 on the serverless runtime.
    const app = express();
    app.set('trust proxy', 1);
    app.use(requestId);
    app.use(jsonBody());
    app.use((req, _res, next) => {
      Object.defineProperty(req, 'socket', { value: null, configurable: true });
      next();
    });
    app.use(rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
    app.post('/probe', (req, res) => res.json({ ip: req.ip }));

    const res = await request(app).post('/probe').send({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.body.ip).toBeTruthy();
  });
});
