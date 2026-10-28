// Clean up test accounts from the database
// Run: node scripts/cleanup-test-users.mjs

import { getPool } from '../src/db/pool.js';
import { logger } from '../src/lib/logger.js';

const TEST_EMAIL_PREFIXES = [
  'test-',
  'e2e-',
  'otp-',
  'journey-',
  'elite-',
  'gone-',
  'mass-',
  'lim-',
  'fro-',
  'sna-',
  'buk-',
  'mik-',
  'win-',
  'abu-',
  'mod-',
];

async function cleanupTestUsers() {
  const pool = await getPool();

  try {
    const deletedUsers = [];

    for (const prefix of TEST_EMAIL_PREFIXES) {
      const { rows } = await pool.query(
        `SELECT id, email FROM users WHERE email LIKE $1`,
        [`${prefix}%`]
      );

      for (const user of rows) {
        deletedUsers.push(user.email);
        await pool.query('DELETE FROM ratings WHERE user_id = $1', [user.id]);
        await pool.query('DELETE FROM saved_places WHERE user_id = $1', [user.id]);
        await pool.query('DELETE FROM reports WHERE user_id = $1', [user.id]);
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
        await pool.query('DELETE FROM otps WHERE email = $1', [user.email]);
        await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
      }
    }

    if (deletedUsers.length > 0) {
      console.log(`✅ Deleted ${deletedUsers.length} test users:`);
      deletedUsers.forEach(email => console.log(`   - ${email}`));

      if (deletedUsers.length > 0) {
        const count = deletedUsers.length;
        console.log(`\n🎉 Successfully cleaned up ${count} test accounts from the database.`);
        console.log(`\n💡 To clean up all accounts, run: npm run db:migrate (re-runs all migrations)`);
      }
    } else {
      console.log('ℹ️  No test accounts found to clean up.');
    }

    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Failed to cleanup test users');
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  }
}

cleanupTestUsers();