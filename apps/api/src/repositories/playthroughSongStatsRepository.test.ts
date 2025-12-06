import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as statsRepo from './playthroughSongStatsRepository.js';
import * as playthroughSongRepo from './playthroughSongRepository.js';
import * as playthroughRepo from './playthroughRepository.js';
import * as userRepo from './userRepository.js';
import * as setlistRepo from './setlistRepository.js';
import * as setlistSongRepo from './setlistSongRepository.js';

describe('playthroughSongStatsRepository', () => {
  let testUserId: number;
  let testSetlistId: number;
  let testPlaythroughId: number;
  let testPlaythroughSongId: number;
  const testSongId = 99950;

  beforeAll(async () => {
    const user = await userRepo.create({
      username: 'ptstatstest',
      passwordHash: 'hash',
      displayName: 'PT Stats Test',
    });
    testUserId = user.id;

    // Create test song
    await pool.query(
      `INSERT INTO songs (id, slug, title, artist, difficulty_drums)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [testSongId, 'pt-stats-song', 'PT Stats Song', 'Test Artist', 3]
    );

    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;

    await setlistSongRepo.addSongs(testSetlistId, [testSongId]);
  });

  beforeEach(async () => {
    // Clean up and create fresh playthrough
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);

    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });
    testPlaythroughId = playthrough.id;

    await playthroughSongRepo.copySongsFromSetlist(testPlaythroughId, testSetlistId);
    const songs = await playthroughSongRepo.getSongs(testPlaythroughId);
    testPlaythroughSongId = songs[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM songs WHERE id = $1', [testSongId]);
    await pool.end();
  });

  it('should create stats entry with rating only', async () => {
    const stats = await statsRepo.create({
      playthroughSongId: testPlaythroughSongId,
      userId: testUserId,
      rating: 4,
    });

    expect(stats.id).toBeDefined();
    expect(stats.playthroughSongId).toBe(testPlaythroughSongId);
    expect(stats.userId).toBe(testUserId);
    expect(stats.rating).toBe(4);
    expect(stats.score).toBeNull();
  });

  it('should create stats entry with full data', async () => {
    const stats = await statsRepo.create({
      playthroughSongId: testPlaythroughSongId,
      userId: testUserId,
      score: 125000,
      notesHit: 450,
      notesMissed: 50,
      longestStreak: 200,
      starsEarned: 5,
      accuracyPct: 90.0,
      rating: 5,
    });

    expect(stats.score).toBe(125000);
    expect(stats.notesHit).toBe(450);
    expect(stats.notesMissed).toBe(50);
    expect(stats.longestStreak).toBe(200);
    expect(stats.starsEarned).toBe(5);
    expect(stats.accuracyPct).toBe(90.0);
  });

  it('should get stats for playthrough song', async () => {
    await statsRepo.create({
      playthroughSongId: testPlaythroughSongId,
      userId: testUserId,
      rating: 3,
    });

    const allStats = await statsRepo.getForPlaythroughSong(testPlaythroughSongId);
    expect(allStats.length).toBe(1);
    expect(allStats[0].rating).toBe(3);
  });

  it('should get stats for specific user', async () => {
    await statsRepo.create({
      playthroughSongId: testPlaythroughSongId,
      userId: testUserId,
      rating: 4,
    });

    const stats = await statsRepo.getForUserAndSong(testUserId, testPlaythroughSongId);
    expect(stats).not.toBeNull();
    expect(stats?.rating).toBe(4);
  });

  it('should update existing stats', async () => {
    const created = await statsRepo.create({
      playthroughSongId: testPlaythroughSongId,
      userId: testUserId,
      rating: 3,
    });

    const updated = await statsRepo.update(created.id, {
      rating: 5,
      score: 100000,
    });

    expect(updated?.rating).toBe(5);
    expect(updated?.score).toBe(100000);
  });
});
