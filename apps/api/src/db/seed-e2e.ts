import { pool } from './pool.js';

/**
 * E2E Test Data Seeder
 *
 * Creates a test setlist for E2E tests.
 * Requires:
 * - Test user exists (username: testuser, from main seed.ts)
 * - Songs exist (from seeds/songs.sql)
 */

async function seedE2E() {
  console.log('Seeding E2E test data...');

  try {
    // Get test user ID
    const userResult = await pool.query(
      `SELECT id FROM users WHERE username = $1`,
      ['testuser']
    );

    if (userResult.rows.length === 0) {
      throw new Error('Test user not found. Run `pnpm db:seed` first to create testuser.');
    }

    const userId = userResult.rows[0].id;
    console.log(`Found test user with ID: ${userId}`);

    // Get 3 songs from the database (any 3 will do)
    const songsResult = await pool.query(
      `SELECT id, title, artist FROM songs ORDER BY id LIMIT 3`
    );

    if (songsResult.rows.length < 3) {
      throw new Error('Not enough songs in database. Run `pnpm db:seed` first to import songs.');
    }

    const songs = songsResult.rows;
    console.log(`Found ${songs.length} songs for test setlist:`);
    songs.forEach(song => console.log(`  - ${song.title} by ${song.artist}`));

    // Check if "Test Setlist" already exists
    const existingSetlist = await pool.query(
      `SELECT id FROM setlists WHERE name = $1 AND user_id = $2`,
      ['Test Setlist', userId]
    );

    let setlistId;
    if (existingSetlist.rows.length > 0) {
      setlistId = existingSetlist.rows[0].id;
      console.log(`Found existing setlist "Test Setlist" with ID: ${setlistId}`);
    } else {
      const setlistResult = await pool.query(
        `INSERT INTO setlists (name, type, user_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Test Setlist', 'manual', userId]
      );
      setlistId = setlistResult.rows[0].id;
      console.log(`Created setlist "Test Setlist" with ID: ${setlistId}`);
    }

    // Clear existing songs from setlist (in case of re-seeding)
    await pool.query(
      `DELETE FROM setlist_songs WHERE setlist_id = $1`,
      [setlistId]
    );

    // Add songs to setlist
    for (let i = 0; i < songs.length; i++) {
      await pool.query(
        `INSERT INTO setlist_songs (setlist_id, song_id, position)
         VALUES ($1, $2, $3)`,
        [setlistId, songs[i].id, i]
      );
    }

    console.log(`Added ${songs.length} songs to "Test Setlist"`);

    console.log('\n✅ E2E test data seeded successfully!');
    console.log('\nE2E Test Credentials:');
    console.log('  Username: testuser');
    console.log('  Password: test123');
    console.log('  Setlist:  Test Setlist (3 songs)');
    console.log('\nRun E2E tests:');
    console.log('  cd apps/frontend && pnpm test:e2e');

  } catch (err) {
    console.error('❌ E2E seeding failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

seedE2E().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
