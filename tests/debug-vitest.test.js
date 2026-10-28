import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const unique = Date.now();
const CREDS = {
  name: 'Test User',
  email: `elite-${unique}@example.com`,
  password: 'supersecret123',
};

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fedcba9876543210';
});

describe('Debug vitest', () => {
  it('signup works', async () => {
    const res = await request(app).post('/auth/signup').send(CREDS);
    console.log('Signup status:', res.status);
    console.log('Signup body:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(201);
  });

  it('duplicate signup fails', async () => {
    const res = await request(app).post('/auth/signup').send(CREDS);
    console.log('Duplicate signup status:', res.status);
    console.log('Duplicate signup body:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(409);
  });
});