import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import request from 'supertest';
import { jsonBody } from '../src/middleware/jsonBody.js';

// The live API answered 500 for every POST with a JSON body because
// express.json() assumes the request is a readable stream. On the Vercel
// runtime it is not, and the resulting TypeError (no status) reached the
// error handler before requestId could run.
//
// These tests pin every shape the body can arrive in.

const runParser = (req) => {
  const res = {};
  return new Promise((resolve) => {
    jsonBody()(req, res, (err) => resolve(err));
  });
};

const makeReq = (headers, body) => ({
  headers,
  body,
  on: () => {},
});

describe('jsonBody parser', () => {
  it('parses a readable stream (the normal case)', async () => {
    const req = Readable.from([Buffer.from('{"a":1}')]);
    req.headers = { 'content-type': 'application/json', 'content-length': '7' };
    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 1 });
  });

  it('parses a body the platform already parsed', async () => {
    const req = makeReq({ 'content-type': 'application/json', 'content-length': '7' }, { a: 1 });
    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 1 });
  });

  it('parses a body the platform buffered', async () => {
    const req = makeReq(
      { 'content-type': 'application/json', 'content-length': '7' },
      Buffer.from('{"a":1}')
    );
    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 1 });
  });

  it('parses a body the platform buffered as a string', async () => {
    const req = makeReq(
      { 'content-type': 'application/json', 'content-length': '7' },
      '{"a":1}'
    );
    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 1 });
  });

  it('survives a request that is not a stream at all (the live failure)', async () => {
    // No .on, no async iterator, no body: this is the shape that made
    // body-parser throw "stream.on is not a function".
    const req = { headers: { 'content-type': 'application/json', 'content-length': '7' } };
    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({});
  });

  it('parses a body behind a read-only accessor (the Vercel runtime shape)', async () => {
    // The runtime exposes `body` as a getter-only property holding the raw
    // body. Assigning to it throws "which has only a getter"; the parser
    // must shadow it instead.
    const raw = Buffer.from('{"a":1}');
    const req = {
      headers: { 'content-type': 'application/json', 'content-length': '7' },
    };
    Object.defineProperty(req, 'body', {
      get: () => raw,
      configurable: true,
    });

    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 1 });
  });

  it('parses a body behind an inherited read-only accessor', async () => {
    const raw = Buffer.from('{"a":2}');
    class PlatformRequest {
      get body() { return raw; }
    }
    const req = new PlatformRequest();
    req.headers = { 'content-type': 'application/json', 'content-length': '7' };

    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 2 });
  });

  it('parses the live runtime shape: an accessor that throws on read AND write', async () => {
    // Exactly what the deployed Vercel runtime does (measured 2026-10-21):
    //   own_body: { writable: false, has_get: true, has_set: true,
    //                configurable: true }
    //   is_stream: true, readable: true, readable_ended: false
    //   reading req.body -> "Error: Invalid JSON"
    //   assigning req.body -> "Error: Invalid JSON"
    // The body itself is intact in the stream.
    const boom = () => { throw new Error('Invalid JSON'); };
    const req = Readable.from([Buffer.from('{"a":1}')]);
    req.headers = { 'content-type': 'application/json', 'content-length': '7' };
    Object.defineProperty(req, 'body', {
      get: boom,
      set: boom,
      configurable: true,
    });

    const err = await runParser(req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ a: 1 });
  });

  it('rejects malformed JSON with a 400-shaped error', async () => {
    const req = makeReq(
      { 'content-type': 'application/json', 'content-length': '8' },
      Buffer.from('not-json')
    );
    const err = await runParser(req);
    expect(err).toBeTruthy();
    expect(err.type).toBe('entity.parse.failed');
    expect(err.status).toBe(400);
  });

  it('rejects an oversized body with a 413-shaped error', async () => {
    const req = makeReq(
      { 'content-type': 'application/json', 'content-length': '999999' },
      Buffer.alloc(999999, 0x61)
    );
    const err = await runParser(req);
    expect(err).toBeTruthy();
    expect(err.type).toBe('entity.too.large');
    expect(err.status).toBe(413);
  });

  it('ignores non-JSON content types and bodiless requests', async () => {
    const form = makeReq({ 'content-type': 'application/x-www-form-urlencoded' }, 'a=1');
    expect(await runParser(form)).toBeUndefined();
    expect(form.body).toBe('a=1');

    const empty = makeReq({ 'content-type': 'application/json' }, undefined);
    expect(await runParser(empty)).toBeUndefined();
    expect(empty.body).toEqual({});
  });
});

describe('the API accepts a JSON body', () => {
  it('POST with a body is validated, not 500', async () => {
    const { app } = await import('../src/app.js');
    const res = await request(app)
      .post('/api/v1/chat')
      .set('content-type', 'application/json')
      .send({ nope: true });
    // The body was parsed (so validation ran) and the request carries a
    // request id — the two things the live 500 broke.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('malformed JSON is a 400 VALIDATION_ERROR, not a 500', async () => {
    const { app } = await import('../src/app.js');
    const res = await request(app)
      .post('/api/v1/chat')
      .set('content-type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeTruthy();
  });
});
