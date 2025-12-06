import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as playthroughSongRepo from './playthroughSongRepository.js';
import * as playthroughRepo from './playthroughRepository.js';
import * as userRepo from './userRepository.js';
import * as setlistRepo from './setlistRepository.js';
import * as setlistSongRepo from './setlistSongRepository.js';

describe('playthroughSongRepository', () => {
  let testUserId: number;
  let testSetlistId: number;
  let testPlaythroughId: number;
  const testSongIds = [99960, 99961, 99962];

  beforeAll(async () => {
    const user = await userRepo.create({
      username: 'ptsongtest',
      passwordHash: 'hash',
      displayName: 'PT Song Test',
    });
    testUserId = user.id;

    // Create test songs
    for (const songId of testSongIds) {
      await pool.query(
        `INSERT INTO songs (id, slug, title, artist, difficulty_drums)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [songId, `pt-song-${songId}`, `PT Song ${songId}`, 'Test Artist', 3]
      );
    }

    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;

    // Add songs to setlist
    await setlistSongRepo.addSongs(testSetlistId, testSongIds);
  });

  beforeEach(async () => {
    // Clean up and create fresh playthrough
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);

    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });
    testPlaythroughId = playthrough.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    for (const songId of testSongIds) {
      await pool.query('DELETE FROM songs WHERE id = $1', [songId]);
    }
    await pool.end();
  });

  it('should copy songs from setlist to playthrough', async () => {
    await playthroughSongRepo.copySongsFromSetlist(testPlaythroughId, testSetlistId);

    const songs = await playthroughSongRepo.getSongs(testPlaythroughId);
    expect(songs.length).toBe(testSongIds.length);
    expect(songs[0].position).toBe(0);
    expect(songs[1].position).toBe(1);
    expect(songs[2].position).toBe(2);
  });

  it('should get song at specific position', async () => {
    await playthroughSongRepo.copySongsFromSetlist(testPlaythroughId, testSetlistId);

    const song = await playthroughSongRepo.getSongAtPosition(testPlaythroughId, 1);
    expect(song).not.toBeNull();
    expect(song?.position).toBe(1);
    expect(song?.songId).toBe(testSongIds[1]);
  });

  it('should update screenshot path', async () => {
    await playthroughSongRepo.copySongsFromSetlist(testPlaythroughId, testSetlistId);
    const songs = await playthroughSongRepo.getSongs(testPlaythroughId);
    const songId = songs[0].id;

    const updated = await playthroughSongRepo.updateScreenshot(
      songId,
      '/screenshots/test.png'
    );
    expect(updated?.screenshotPath).toBe('/screenshots/test.png');
  });

  it('should count total songs in playthrough', async () => {
    await playthroughSongRepo.copySongsFromSetlist(testPlaythroughId, testSetlistId);

    const count = await playthroughSongRepo.countSongs(testPlaythroughId);
    expect(count).toBe(testSongIds.length);
  });
});
