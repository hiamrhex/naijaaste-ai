import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API baseline', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'Str0ng!Passw0rd',
    });
    token = res.body.accessToken;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.endpoints).toContain('POST /api/v1/chat');
  });

  it('POST /chat without message returns 400', async () => {
    const res = await request(app).post('/chat').set(auth()).send({}).expect(400);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET unknown session returns 404', async () => {
    const res = await request(app)
      .get('/chat/11111111-1111-4111-8111-111111111111')
      .set(auth())
      .expect(404);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});