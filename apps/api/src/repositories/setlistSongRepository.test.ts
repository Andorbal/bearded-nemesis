import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as setlistSongRepo from './setlistSongRepository.js';
import * as setlistRepo from './setlistRepository.js';
import * as userRepo from './userRepository.js';

describe('setlistSongRepository', () => {
  let testUserId: number;
  let testSetlistId: number;
  const testSongIds = [99990, 99991, 99992];

  beforeAll(async () => {
    const user = await userRepo.create({
      username: 'setlistsongtest',
      passwordHash: 'hash',
      displayName: 'SetlistSong Test',
    });
    testUserId = user.id;

    // Create test songs
    for (const songId of testSongIds) {
      await pool.query(
        `INSERT INTO songs (id, slug, title, artist, difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [songId, `test-song-${songId}`, `Test Song ${songId}`, 'Test Artist', 3, 3, 3, 3]
      );
    }
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    for (const songId of testSongIds) {
      await pool.query('DELETE FROM songs WHERE id = $1', [songId]);
    }
    await pool.end();
  });

  it('should add songs to setlist', async () => {
    await setlistSongRepo.addSongs(testSetlistId, [testSongIds[0], testSongIds[1]]);

    const songs = await setlistSongRepo.getSongs(testSetlistId);
    expect(songs.length).toBe(2);
    expect(songs[0].position).toBe(0);
    expect(songs[1].position).toBe(1);
  });

  it('should remove a song from setlist', async () => {
    await setlistSongRepo.addSongs(testSetlistId, testSongIds);

    await setlistSongRepo.removeSong(testSetlistId, testSongIds[1]);

    const songs = await setlistSongRepo.getSongs(testSetlistId);
    expect(songs.length).toBe(2);
    expect(songs.map(s => s.songId)).not.toContain(testSongIds[1]);
  });

  it('should reorder songs', async () => {
    await setlistSongRepo.addSongs(testSetlistId, testSongIds);

    // Move song at position 2 to position 0
    await setlistSongRepo.reorder(testSetlistId, [testSongIds[2], testSongIds[0], testSongIds[1]]);

    const songs = await setlistSongRepo.getSongs(testSetlistId);
    expect(songs[0].songId).toBe(testSongIds[2]);
    expect(songs[1].songId).toBe(testSongIds[0]);
    expect(songs[2].songId).toBe(testSongIds[1]);
  });

  it('should clear all songs', async () => {
    await setlistSongRepo.addSongs(testSetlistId, testSongIds);

    await setlistSongRepo.clearSongs(testSetlistId);

    const songs = await setlistSongRepo.getSongs(testSetlistId);
    expect(songs.length).toBe(0);
  });
});
