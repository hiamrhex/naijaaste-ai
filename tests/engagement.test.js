import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const PREV = { ADMIN_EMAILS: process.env.ADMIN_EMAILS };

let app;
let userToken;
let adminToken;

const signup = async (name, email, password = 'Str0ng!Passw0rd') => { // secret-scan: allow — throwaway test-account fixture, never a real credential
  const res = await request(app).post('/auth/signup').send({ name, email, password });
  return res.body;
};

beforeAll(async () => {
  const stamp = Date.now();
  process.env.ADMIN_EMAILS = `boss${stamp}@example.com`;
  ({ app } = await import('../src/app.js'));
  const u = await signup('Regular U', `u${stamp}@example.com`);
  userToken = u.accessToken;
  const a = await signup('Boss Lady', `boss${stamp}@example.com`);
  adminToken = a.accessToken;
  // DB init + two bcrypt signups; generous under parallel CI load.
}, 60000);

afterAll(() => {
  if (PREV.ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = PREV.ADMIN_EMAILS;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('ratings (C)', () => {
  it('401 without token, 400 for bad stars', async () => {
    await request(app).post('/ratings').send({ restaurant_id: 'r001', stars: 5 }).expect(401);
    await request(app).post('/ratings').set(auth(userToken)).send({ restaurant_id: 'r001', stars: 6 }).expect(400);
    await request(app).post('/ratings').set(auth(userToken)).send({ restaurant_id: 'r001', stars: 4.5 }).expect(400);
    await request(app).post('/ratings').set(auth(userToken)).send({ stars: 4 }).expect(400);
  });

  it('201 stores a rating; GET returns only your own', async () => {
    const res = await request(app).post('/ratings')
      .set(auth(userToken))
      .send({ restaurant_id: 'r001', stars: 5, note: 'Amala elite', context: 'saved' })
      .expect(201);
    expect(res.body.data).toMatchObject({ restaurant_id: 'r001', stars: 5, context: 'saved' });
    expect(res.body.data.user_id).toBeDefined();
    const mine = await request(app).get('/ratings').set(auth(userToken)).expect(200);
    expect(mine.body.data.length).toBeGreaterThanOrEqual(1);
    expect(mine.body.data.every((r) => r.user_id === res.body.data.user_id)).toBe(true);
  });
});

describe('reports (D)', () => {
  it('401 without token, 400 for bad type/message', async () => {
    await request(app).post('/reports').send({ type: 'bug', message: 'x broke' }).expect(401);
    await request(app).post('/reports').set(auth(userToken)).send({ type: 'nope', message: 'valid message here' }).expect(400);
    await request(app).post('/reports').set(auth(userToken)).send({ type: 'bug', message: 'x' }).expect(400);
  });

  it('201 returns a ticket and auto-attaches diagnostics', async () => {
    const res = await request(app).post('/reports')
      .set(auth(userToken))
      .send({ type: 'wrong-info', message: 'Price is off', screen: 'Map', device: 'Pixel', app_version: '1.0.0', restaurant_id: 'r001' })
      .expect(201);
    expect(res.body.data.ticket).toMatch(/^NT-[A-Z0-9]{6}$/);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.request_id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(res.body.data.screen).toBe('Map');
    expect(res.body.data).not.toHaveProperty('screenshot');
  });
});

describe('admin (role-scoped)', () => {
  it('401 without token, 403 for non-admin', async () => {
    await request(app).get('/admin/stats').expect(401);
    await request(app).get('/admin/stats').set(auth(userToken)).expect(403);
    await request(app).get('/admin/reports').set(auth(userToken)).expect(403);
  });

  it('admin sees stats, inbox, and can triage', async () => {
    const stats = await request(app).get('/admin/stats').set(auth(adminToken)).expect(200);
    expect(stats.body.data.users).toBeGreaterThanOrEqual(2);
    expect(stats.body.data.reports).toMatchObject({ open: expect.any(Number) });
    const inbox = await request(app).get('/admin/reports').set(auth(adminToken)).expect(200);
    expect(Array.isArray(inbox.body.data)).toBe(true);
    const ticket = inbox.body.data[0]?.ticket;
    if (ticket) {
      const patched = await request(app).patch(`/admin/reports/${ticket}`).set(auth(adminToken)).send({ status: 'in_review' }).expect(200);
      expect(patched.body.data.status).toBe('in_review');
    }
    await request(app).patch('/admin/reports/NT-NOPE00').set(auth(adminToken)).send({ status: 'resolved' }).expect(404);
  });

  it('admin sees role in /auth/me; regular user does not', async () => {
    const me = await request(app).get('/auth/me').set(auth(adminToken)).expect(200);
    expect(me.body.user.role).toBe('admin');
    const me2 = await request(app).get('/auth/me').set(auth(userToken)).expect(200);
    expect(me2.body.user.role).toBe('user');
  });
});
