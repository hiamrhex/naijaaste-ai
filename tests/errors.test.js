import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { badRequest, notFound } from '../src/lib/errors.js';

describe('error contract (layers 19/20/26/27)', () => {
  it('validation failure carries error.code and requestId', async () => {
    const res = await request(app).post('/chat').send({}).expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'message is required' });
    expect(res.body.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('honors an inbound X-Request-Id and returns it in the header', async () => {
    const res = await request(app)
      .get('/health')
      .set('X-Request-Id', 'client-abc-12345678')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('client-abc-12345678');
  });

  it('rejects over-long chat messages with 400 (was 200)', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'x'.repeat(501) })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE of a missing session returns 404 SESSION_NOT_FOUND (was 200)', async () => {
    const res = await request(app)
      .delete('/chat/11111111-1111-4111-8111-111111111111')
      .expect(404);
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('unknown route returns 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.available_endpoints).toContain('GET  /health');
  });

  it('review with missing body returns 400 without calling the LLM', async () => {
    const res = await request(app).post('/generate-review').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recommend with missing persona returns 400 without calling the LLM', async () => {
    const res = await request(app).post('/recommend').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps ApiError and upstream errors correctly (unit)', () => {
    const makeRes = () => ({
      statusCode: 0,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
    });
    const noop = () => {};

    const r1 = makeRes();
    errorHandler(badRequest('bad field'), { id: 'x' }, r1, noop);
    expect(r1.statusCode).toBe(400);
    expect(r1.body.error.code).toBe('VALIDATION_ERROR');

    const r2 = makeRes();
    errorHandler(notFound('NO_MATCHES', 'nope'), { id: 'x' }, r2, noop);
    expect(r2.statusCode).toBe(404);
    expect(r2.body.error.code).toBe('NO_MATCHES');

    const r3 = makeRes();
    errorHandler(Object.assign(new Error('boom'), { status: 503 }), { id: 'x' }, r3, noop);
    expect(r3.statusCode).toBe(502);
    expect(r3.body.error.code).toBe('UPSTREAM_FAILURE');
    expect(r3.body.error.message).not.toBe('boom'); // no upstream leak

    const r4 = makeRes();
    errorHandler(new Error('boom'), { id: 'x' }, r4, noop);
    expect(r4.statusCode).toBe(500);
    expect(r4.body.error.code).toBe('INTERNAL');
    expect(r4.body.error.message).toBe('Internal server error'); // no message leak
  });
});
