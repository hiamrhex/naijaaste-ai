import request from 'supertest';
import { app } from './src/app.js';

const stamp = Date.now();
const KNOWN = `timing-known-${stamp}@example.com`;
const UNKNOWN = `timing-unknown-${stamp}@example.com`;
const PASS = 'Str0ng!Passw0rd!';

const signup = (email) =>
  request(app).post('/auth/signup').send({ name: 'Timing Probe', email, password: PASS });

async function test() {
  try {
    const res = await signup(KNOWN);
    console.log('Signup status:', res.status);
    console.log('Signup body:', JSON.stringify(res.body, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

test();