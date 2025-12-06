import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as songRatingRepo from './songRatingRepository.js';
import * as userRepo from './userRepository.js';

describe('songRatingRepository', () => {
  const testSongId = 99997;

  async function createTestUser() {
    // Create a test user with timestamp to avoid conflicts
    const username = `songratingtest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const user = await userRepo.create({
      username,
      passwordHash: 'hash',
      displayName: 'SongRating Test',
    });
    return user.id;
  }

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO songs (id, slug, title, artist, difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [testSongId, 'test-rating', 'Test Rating', 'Test Artist', 3, 3, 3, 3]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM song_ratings WHERE song_id = $1', [testSongId]);
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['songratingtest_%']);
    await pool.query('DELETE FROM songs WHERE id = $1', [testSongId]);
    await pool.end();
  });

  it('should create a play rating', async () => {
    const testUserId = await createTestUser();
    const rating = await songRatingRepo.create({
      userId: testUserId,
      songId: testSongId,
      instrument: 'drums',
      rating: 4,
    });

    expect(rating.id).toBeDefined();
    expect(rating.rating).toBe(4);
    expect(rating.instrument).toBe('drums');
  });

  it('should get ratings for user/song/instrument', async () => {
    const testUserId = await createTestUser();
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 3 });
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 4 });
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 5 });

    const ratings = await songRatingRepo.getForUserSongInstrument(testUserId, testSongId, 'drums');
    expect(ratings.length).toBe(3);
  });

  it('should get average rating', async () => {
    const testUserId = await createTestUser();
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 3 });
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 5 });

    const avg = await songRatingRepo.getAverageRating(testUserId, testSongId, 'drums');
    expect(avg).toBe(4);
  });

  it('should get latest rating', async () => {
    const testUserId = await createTestUser();
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 3 });
    await songRatingRepo.create({ userId: testUserId, songId: testSongId, instrument: 'drums', rating: 5 });

    const latest = await songRatingRepo.getLatestRating(testUserId, testSongId, 'drums');
    expect(latest?.rating).toBe(5);
  });
});
