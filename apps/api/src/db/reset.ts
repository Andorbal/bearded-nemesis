import { pool } from './pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function reset() {
  console.log('Resetting database...');

  // Drop all tables in reverse dependency order
  console.log('Dropping all tables...');
  await pool.query(`
    DROP TABLE IF EXISTS playthrough_song_stats CASCADE;
    DROP TABLE IF EXISTS playthrough_songs CASCADE;
    DROP TABLE IF EXISTS playthrough_players CASCADE;
    DROP TABLE IF EXISTS playthroughs CASCADE;
    DROP TABLE IF EXISTS setlist_songs CASCADE;
    DROP TABLE IF EXISTS setlists CASCADE;
    DROP TABLE IF EXISTS song_ratings CASCADE;
    DROP TABLE IF EXISTS user_songs CASCADE;
    DROP TABLE IF EXISTS songs CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS admin_audit_log CASCADE;
    DROP TABLE IF EXISTS ocr_jobs CASCADE;
    DROP TABLE IF EXISTS migrations CASCADE;
  `);

  console.log('All tables dropped. Running migrations...');

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`Failed to apply ${file}:`, err);
      throw err;
    }
  }

  console.log('Database reset complete');
  await pool.end();
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
