// Seed an admin user for testing.
//
// Credentials must come from the environment: committing a default password
// means every deployment that runs this script shares the same known login.
// Run: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' node scripts/seed-admin.mjs
import { getPool } from '../src/db/pool.js';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Admin';

async function seedAdminUser() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set. Refusing to seed a default account.');
    process.exit(1);
  }

  const pool = await getPool();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  try {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role`,
      [ADMIN_EMAIL, ADMIN_NAME, passwordHash, 'admin']
    );

    console.log('✅ Admin user seeded successfully!');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Role: admin');

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err.message);
    process.exit(1);
  }
}

seedAdminUser();
