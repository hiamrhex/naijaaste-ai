// Seed an admin user for testing
import { getPool } from './pool.js';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';
const ADMIN_NAME = 'System Admin';

async function seedAdminUser() {
  const pool = await getPool();

  // Hash the password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  try {
    const result = await pool.query(
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
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('   Role: admin');

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err.message);
    process.exit(1);
  }
}

seedAdminUser();