import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API baseline', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.endpoints).toContain('POST /chat');
  });

  it('POST /chat without message returns 400', async () => {
    const res = await request(app).post('/chat').send({}).expect(400);
    expect(res.body.success).toBe(false);
  });

  it('GET unknown session returns 404', async () => {
    const res = await request(app)
      .get('/chat/11111111-1111-4111-8111-111111111111')
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body.success).toBe(false);
  });
});
