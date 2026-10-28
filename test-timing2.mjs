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
    // First signup
    const res1 = await signup(KNOWN);
    console.log('First signup status:', res1.status);
    console.log('First signup body:', JSON.stringify(res1.body, null, 2));
    
    // Second signup (should fail with 409)
    const res2 = await signup(KNOWN);
    console.log('Second signup status:', res2.status);
    console.log('Second signup body:', JSON.stringify(res2.body, null, 2));
    
    // Sign in with wrong password
    const res3 = await request(app).post('/auth/signin').send({ email: KNOWN, password: 'wrong' });
    console.log('Signin wrong password status:', res3.status);
    console.log('Signin wrong password body:', JSON.stringify(res3.body, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

test();