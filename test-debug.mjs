import request from 'supertest';
import { app } from './src/app.js';

const unique = Date.now();
const CREDS = {
  name: 'Test User',
  email: `test-${unique}@example.com`,
  password: 'supersecret123',
};

async function test() {
  try {
    const res = await request(app).post('/auth/signup').send(CREDS);
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

test();