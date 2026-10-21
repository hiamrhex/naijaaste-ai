import { describe, it, expect } from 'vitest';
import { ApiClientError, readJson } from '../src/lib/api.js';

const fakeResponse = ({ status = 200, contentType = 'application/json', body = '', headers = {} }) => {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => {
        const key = name.toLowerCase();
        if (key === 'content-type') return contentType;
        return normalized[key] ?? null;
      },
    },
    json: async () => JSON.parse(body),
    text: async () => body,
  };
};

describe('safe API response parsing (frontend)', () => {
  it('a plain-text 500 (Vercel kill) becomes a friendly retryable error, never a parser error', async () => {
    const res = fakeResponse({
      status: 500,
      contentType: 'text/plain; charset=utf-8',
      body: 'An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT',
      headers: { 'x-request-id': 'req-live-1234' },
    });

    let error;
    try {
      await readJson(res);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.status).toBe(500);
    expect(error.requestId).toBe('req-live-1234');
    expect(error.userMessage).toContain('Request ID: req-live-1234');
    expect(error.userMessage).not.toMatch(/Unexpected token|An error occurred|FUNCTION_INVOCATION/i);
    expect(error.retryable).toBe(true);
  });

  it('a 200 with HTML is rejected with a friendly BAD_RESPONSE', async () => {
    const res = fakeResponse({
      status: 200,
      contentType: 'text/html',
      body: '<html>proxy error</html>',
    });

    await expect(readJson(res)).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      status: 200,
    });
  });

  it('a well-formed JSON 503 AI_TIMEOUT keeps the code and requestId from the body', async () => {
    const res = fakeResponse({
      status: 503,
      body: JSON.stringify({
        error: { code: 'AI_TIMEOUT', message: 'slow', requestId: 'srv-abc-9999' },
      }),
    });

    let error;
    try {
      await readJson(res);
    } catch (err) {
      error = err;
    }

    expect(error.code).toBe('AI_TIMEOUT');
    expect(error.requestId).toBe('srv-abc-9999');
    expect(error.userMessage).toMatch(/took too long/i);
    expect(error.userMessage).toContain('Request ID: srv-abc-9999');
  });

  it('a 4xx JSON error still surfaces the server validation message', async () => {
    const res = fakeResponse({
      status: 400,
      body: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'message is required' } }),
    });

    await expect(readJson(res)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'message is required',
    });
  });

  it('valid JSON success is returned unchanged', async () => {
    const res = fakeResponse({ status: 200, body: JSON.stringify({ success: true, message: 'hi' }) });
    await expect(readJson(res)).resolves.toEqual({ success: true, message: 'hi' });
  });
});
