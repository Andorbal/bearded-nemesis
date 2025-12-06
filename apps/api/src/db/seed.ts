import { pool } from './pool.js';
import { hashPassword } from '../utils/password.js';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const songsFile = path.join(__dirname, 'seeds', 'songs.sql');

async function seed() {
  console.log('Seeding database...');

  // Create admin user
  const adminHash = await hashPassword('admin123');
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, xbox_gamertag, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username) DO NOTHING`,
    ['admin', adminHash, 'Admin User', 'AdminGamer', true]
  );

  // Create test user
  const testHash = await hashPassword('test123');
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, xbox_gamertag, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username) DO NOTHING`,
    ['testuser', testHash, 'Test User', 'TestGamer', false]
  );

  // Seed songs if SQL file exists
  if (existsSync(songsFile)) {
    console.log('Seeding songs...');
    const songsSql = await readFile(songsFile, 'utf-8');
    await pool.query(songsSql);
    console.log('Songs seeded');
  } else {
    console.log('No songs.sql found - run scripts/build-songs first');
  }

  console.log('Seeding complete');
  console.log('Admin user: admin / admin123');
  console.log('Test user: testuser / test123');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
