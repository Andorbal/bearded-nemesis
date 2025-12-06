import fs from 'fs';
import path from 'path';
import { pool } from './pool.js';

async function importSongs() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: pnpm db:import-songs <path-to-seed.sql>');
    process.exit(1);
  }

  const absolutePath = path.resolve(sqlPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`Importing songs from ${absolutePath}...`);
  const sql = fs.readFileSync(absolutePath, 'utf-8');

  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');

    const result = await pool.query('SELECT COUNT(*) as count FROM songs');
    console.log(`Import complete. Total songs: ${result.rows[0].count}`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Import failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

importSongs().catch((err) => {
  console.error(err);
  process.exit(1);
});
