import { readFileSync } from 'node:fs';

const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
const need = [
  'GEMINI_API_KEY', 'DATABASE_URL', 'DATABASE_URL_DIRECT',
  'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN',
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'ADMIN_EMAILS', 'GOOGLE_CLIENT_ID',
];
for (const k of need) {
  const l = lines.find((x) => x.startsWith(k + '='));
  const v = l ? l.slice(k.length + 1).trim() : '';
  const commented = lines.some((x) => x.startsWith('#' + k + '='));
  console.log(`${k}: ${v ? 'set (len ' + v.length + ')' : commented ? 'COMMENTED-OUT' : 'MISSING'}`);
}
