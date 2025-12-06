import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as userSongRepo from './userSongRepository.js';
import * as songRepo from './songRepository.js';
import * as userRepo from './userRepository.js';

describe('userSongRepository', () => {
  const testSongId = 99998;

  async function createTestUser() {
    // Create a test user with timestamp to avoid conflicts
    const username = `usersongtest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const user = await userRepo.create({
      username,
      passwordHash: 'hash',
      displayName: 'UserSong Test',
    });
    return user.id;
  }

  beforeAll(async () => {
    // Create test song once
    await pool.query(
      `INSERT INTO songs (id, slug, title, artist, difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [testSongId, 'test-ownership', 'Test Ownership', 'Test Artist', 3, 3, 3, 3]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM user_songs WHERE song_id = $1', [testSongId]);
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['usersongtest_%']);
    await pool.query('DELETE FROM songs WHERE id = $1', [testSongId]);
    await pool.end();
  });

  it('should mark a song as owned', async () => {
    const testUserId = await createTestUser();
    const result = await userSongRepo.setOwned(testUserId, testSongId, true);
    expect(result.owned).toBe(true);
  });

  it('should mark a song as not owned', async () => {
    const testUserId = await createTestUser();
    await userSongRepo.setOwned(testUserId, testSongId, true);
    const result = await userSongRepo.setOwned(testUserId, testSongId, false);
    expect(result.owned).toBe(false);
  });

  it('should rate a song', async () => {
    const testUserId = await createTestUser();
    const result = await userSongRepo.setSongRating(testUserId, testSongId, 4);
    expect(result.songRating).toBe(4);
  });

  it('should get user song data', async () => {
    const testUserId = await createTestUser();
    await userSongRepo.setOwned(testUserId, testSongId, true);
    await userSongRepo.setSongRating(testUserId, testSongId, 5);

    const data = await userSongRepo.get(testUserId, testSongId);
    expect(data).not.toBeNull();
    expect(data?.owned).toBe(true);
    expect(data?.songRating).toBe(5);
  });

  it('should get all owned songs for user', async () => {
    const testUserId = await createTestUser();
    await userSongRepo.setOwned(testUserId, testSongId, true);

    const owned = await userSongRepo.getOwnedSongIds(testUserId);
    expect(owned).toContain(testSongId);
  });
});
