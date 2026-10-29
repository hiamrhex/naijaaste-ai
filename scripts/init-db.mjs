#!/usr/bin/env node

// Initialize local development database with test data
// Run: node scripts/init-db.mjs

import { Pool } from 'pg';

console.log('🗄️  Initializing Local Database\n');

async function init() {
  // Check if we're using pg-mem or real database
  const usePgMem = !process.env.DATABASE_URL;

  if (usePgMem) {
    console.log('✓ Using pg-mem for local development\n');
    console.log('📝 Note: pg-mem is ephemeral and will reset on restart.');
    console.log('   For persistent data, set DATABASE_URL in .env\n');
    console.log('✅ Database ready - no setup needed!\n');
    return;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 10000,
    });

    console.log('📋 Checking database tables...\n');

    // Check for required tables
    const tables = ['users', 'sessions', 'otps', 'restaurants', 'ratings', 'reports', 'saved_places', 'refresh_tokens', 'favorites', 'auth_attempts'];
    const client = await pool.connect();

    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`, [table]
      );

      if (result.rows[0].exists) {
        console.log(`✓ Table ${table} exists`);
      } else {
        console.log(`⚠️  Table ${table} missing - run migrations: npm run db:migrate`);
      }
    }

    // Check for recent migrations. On a fresh database this table does not
    // exist yet, and querying it unconditionally aborted the whole script with
    // a confusing error after it had already told the user to run migrations.
    const migExists = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      )`
    );

    if (migExists.rows[0].exists) {
      const migResult = await client.query(
        'SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 5'
      );
      if (migResult.rows.length > 0) {
        console.log('\n📋 Recent migrations:');
        migResult.rows.forEach((mig) => {
          console.log(`  - ${mig.version}`);
        });
      }
    } else {
      console.log('\n⚠️  No migrations recorded - run: npm run db:migrate');
    }

    client.release();

    console.log('\n✅ Database setup complete!');

    // Check for test data
    console.log('\n📊 Checking for test data...');

    const counts = {
      users: await pool.query('SELECT COUNT(*) FROM users'),
      restaurants: await pool.query('SELECT COUNT(*) FROM restaurants'),
      ratings: await pool.query('SELECT COUNT(*) FROM ratings'),
      reports: await pool.query('SELECT COUNT(*) FROM reports'),
    };

    console.log(`  Users: ${counts.users.rows[0].count}`);
    console.log(`  Restaurants: ${counts.restaurants.rows[0].count}`);
    console.log(`  Ratings: ${counts.ratings.rows[0].count}`);
    console.log(`  Reports: ${counts.reports.rows[0].count}`);

    await pool.end();
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
    console.error('\nMake sure DATABASE_URL is set correctly in .env');
    process.exit(1);
  }
}

init();