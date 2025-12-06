import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as smartSetlistService from './smartSetlistService.js';
import * as userRepo from '../repositories/userRepository.js';
import * as userSongRepo from '../repositories/userSongRepository.js';

describe('smartSetlistService', () => {
  let testUserId: number;
  const testSongIds = [99980, 99981, 99982, 99983, 99984];

  beforeAll(async () => {
    const user = await userRepo.create({
      username: 'smartsetlisttest',
      passwordHash: 'hash',
      displayName: 'Smart Setlist Test',
    });
    testUserId = user.id;

    // Create test songs with varying difficulties
    const songs = [
      { id: 99980, slug: 'easy-song', title: 'Easy Song', difficulty: 2 },
      { id: 99981, slug: 'medium-song', title: 'Medium Song', difficulty: 4 },
      { id: 99982, slug: 'hard-song', title: 'Hard Song', difficulty: 6 },
      { id: 99983, slug: 'expert-song', title: 'Expert Song', difficulty: 7 },
      { id: 99984, slug: 'unowned-song', title: 'Unowned Song', difficulty: 3 },
    ];

    for (const song of songs) {
      await pool.query(
        `INSERT INTO songs (id, slug, title, artist, difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals)
         VALUES ($1, $2, $3, $4, $5, $5, $5, $5)
         ON CONFLICT (id) DO NOTHING`,
        [song.id, song.slug, song.title, 'Test Artist', song.difficulty]
      );
    }

    // Mark most songs as owned
    for (const songId of testSongIds.slice(0, 4)) {
      await userSongRepo.setOwned(testUserId, songId, true);
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM user_songs WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    for (const songId of testSongIds) {
      await pool.query('DELETE FROM songs WHERE id = $1', [songId]);
    }
    await pool.end();
  });

  it('should filter by difficulty', async () => {
    const songs = await smartSetlistService.generateSongList(testUserId, {
      minDifficulty: 5,
      maxDifficulty: 7,
    });

    expect(songs.every(s => (s.difficultyDrums ?? 0) >= 5)).toBe(true);
  });

  it('should filter by owned only', async () => {
    const songs = await smartSetlistService.generateSongList(testUserId, {
      ownedOnly: true,
    });

    // Should not include 99984 (unowned)
    expect(songs.some(s => s.id === 99984)).toBe(false);
  });

  it('should sort by difficulty', async () => {
    const songs = await smartSetlistService.generateSongList(testUserId, {
      sortBy: 'difficulty',
      sortOrder: 'desc',
    });

    for (let i = 1; i < songs.length; i++) {
      expect((songs[i - 1].difficultyDrums ?? 0) >= (songs[i].difficultyDrums ?? 0)).toBe(true);
    }
  });
});
