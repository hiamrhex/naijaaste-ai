// Read-only cold-start probe: boots the Express app in-process, makes ONE
// readiness request (which wakes Neon), and prints only timings — never the
// connection string or any credential.
import 'dotenv/config';
import request from 'supertest';

const boot = Date.now();
const { app } = await import('../src/app.js');
const res = await request(app).get('/health/ready');
const { getDbTiming, closePool } = await import('../src/db/pool.js');

console.log(JSON.stringify({
  status: res.status,
  ready: res.body.ready,
  db: res.body.db,
  boot_to_response_ms: Date.now() - boot,
  db_timing: getDbTiming(),
}, null, 2));

await closePool();
