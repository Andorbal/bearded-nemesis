import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db/pool.js';
import * as builderService from './setlistBuilderService.js';
import * as userRepo from '../repositories/userRepository.js';
import * as userSongRepo from '../repositories/userSongRepository.js';
import type { BuilderPreset } from '@bearded-nemesis/shared';

describe('setlistBuilderService', () => {
  let testUserId1: number;
  let testUserId2: number;
  const testSongIds = [99970, 99971, 99972];

  beforeAll(async () => {
    const user1 = await userRepo.create({
      username: 'buildertest1',
      passwordHash: 'hash',
      displayName: 'Builder Test 1',
    });
    testUserId1 = user1.id;

    const user2 = await userRepo.create({
      username: 'buildertest2',
      passwordHash: 'hash',
      displayName: 'Builder Test 2',
    });
    testUserId2 = user2.id;

    // Create test songs
    for (let i = 0; i < testSongIds.length; i++) {
      await pool.query(
        `INSERT INTO songs (id, slug, title, artist, duration_ms, bpm, difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          testSongIds[i],
          `builder-song-${i}`,
          `Builder Song ${i}`,
          'Test Artist',
          180000,
          120 + i * 10,
          3 + i,
          3 + i,
          3 + i,
          3 + i,
        ]
      );
    }

    // Mark songs as owned by user1 (host)
    for (const songId of testSongIds) {
      await userSongRepo.setOwned(testUserId1, songId, true);
    }

    // Add song ratings in user_songs
    await pool.query(
      `UPDATE user_songs SET song_rating = $1 WHERE user_id = $2 AND song_id = $3`,
      [4, testUserId1, testSongIds[0]]
    );
    await pool.query(
      `UPDATE user_songs SET song_rating = $1 WHERE user_id = $2 AND song_id = $3`,
      [5, testUserId1, testSongIds[1]]
    );

    // Add play ratings (song_ratings table)
    for (const songId of testSongIds) {
      await pool.query(
        `INSERT INTO song_ratings (user_id, song_id, instrument, rating)
         VALUES ($1, $2, $3, $4)`,
        [testUserId1, songId, 'drums', 4]
      );
      await pool.query(
        `INSERT INTO song_ratings (user_id, song_id, instrument, rating)
         VALUES ($1, $2, $3, $4)`,
        [testUserId2, songId, 'guitar', 5]
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM song_ratings WHERE user_id IN ($1, $2)', [testUserId1, testUserId2]);
    await pool.query('DELETE FROM user_songs WHERE user_id IN ($1, $2)', [testUserId1, testUserId2]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId1, testUserId2]);
    for (const songId of testSongIds) {
      await pool.query('DELETE FROM songs WHERE id = $1', [songId]);
    }
    await pool.end();
  });

  describe('gatherCandidates', () => {
    it('should gather candidate songs owned by host', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
          { userId: testUserId2, instrument: 'guitar', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      expect(candidates.length).toBe(testSongIds.length);
      expect(candidates.every(c => testSongIds.includes(c.song.song_id))).toBe(true);
    });

    it('should aggregate ratings from multiple players', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
          { userId: testUserId2, instrument: 'guitar', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      // Each candidate should have ratings from both players
      for (const candidate of candidates) {
        expect(candidate.ratings.length).toBe(2);
        const user1Rating = candidate.ratings.find(r => r.user_id === testUserId1);
        const user2Rating = candidate.ratings.find(r => r.user_id === testUserId2);
        expect(user1Rating).toBeDefined();
        expect(user2Rating).toBeDefined();
      }
    });

    it('should include play ratings for each player', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      // User1 rated all songs on drums as 4
      for (const candidate of candidates) {
        const user1Rating = candidate.ratings.find(r => r.user_id === testUserId1);
        expect(user1Rating?.play_rating).toBe(4);
      }
    });

    it('should include song ratings from user_songs', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
        ],
        objective: 'song_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      // Find the song with rating 4
      const song0 = candidates.find(c => c.song.song_id === testSongIds[0]);
      expect(song0?.ratings[0].song_rating).toBe(4);

      // Find the song with rating 5
      const song1 = candidates.find(c => c.song.song_id === testSongIds[1]);
      expect(song1?.ratings[0].song_rating).toBe(5);
    });

    it('should exclude songs not owned by host', async () => {
      // Add a song owned by user2 but not user1
      await pool.query(
        `INSERT INTO songs (id, slug, title, artist, difficulty_drums)
         VALUES (99973, 'unowned', 'Unowned Song', 'Test', 3)
         ON CONFLICT (id) DO NOTHING`
      );
      await userSongRepo.setOwned(testUserId2, 99973, true);

      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      // Should not include song 99973
      expect(candidates.every(c => c.song.song_id !== 99973)).toBe(true);

      // Cleanup
      await pool.query('DELETE FROM user_songs WHERE song_id = 99973');
      await pool.query('DELETE FROM songs WHERE id = 99973');
    });

    it('should return empty array when host owns no songs', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId2, instrument: 'drums', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      // User2 owns no songs
      const candidates = await builderService.gatherCandidates(testUserId2, preset);
      expect(candidates.length).toBe(0);
    });

    it('should include song metadata like duration and bpm', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      for (const candidate of candidates) {
        expect(candidate.song.duration_ms).toBe(180000);
        expect(candidate.song.bpm).toBeGreaterThanOrEqual(120);
      }
    });

    it('should use correct difficulty for primary instrument', async () => {
      const preset: BuilderPreset = {
        name: 'Test Preset',
        players: [
          { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
        ],
        objective: 'play_rating',
        ratingAggregation: 'average',
        constraints: {},
      };

      const candidates = await builderService.gatherCandidates(testUserId1, preset);

      // Each song has different difficulty (3, 4, 5 for test songs)
      const difficulties = candidates.map(c => c.song.difficulty).sort();
      expect(difficulties).toEqual([3, 4, 5]);
    });
  });
});
