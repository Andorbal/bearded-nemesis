import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from '@fastify/jwt';
import { pool } from '../db/pool.js';
import * as userRepo from '../repositories/userRepository.js';
import * as setlistRepo from '../repositories/setlistRepository.js';
import * as setlistSongRepo from '../repositories/setlistSongRepository.js';
import * as songRepo from '../repositories/songRepository.js';
import * as playthroughRepo from '../repositories/playthroughRepository.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
import * as playthroughPlayerRepo from '../repositories/playthroughPlayerRepository.js';
import * as playthroughSongStatsRepo from '../repositories/playthroughSongStatsRepository.js';
import playthroughRoutes from './playthroughs.js';
import type { JwtPayload } from '@bearded-nemesis/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

describe('Playthrough Routes', () => {
  let app: FastifyInstance;
  let userToken: string;
  let testUserId: number;
  let testSetlistId: number;
  let testPlaythroughId: number;
  let testSongIds: number[] = [];

  beforeAll(async () => {
    // Create test user
    const user = await userRepo.create({
      username: 'playthrough_test_user',
      passwordHash: 'hash',
      displayName: 'Test User',
      isAdmin: false,
    });
    testUserId = user.id;

    // Create test songs
    const song1 = await songRepo.create({
      id: 999991,
      slug: 'test-song-playthrough-1',
      title: 'Test Song 1',
      artist: 'Test Artist',
    });
    const song2 = await songRepo.create({
      id: 999992,
      slug: 'test-song-playthrough-2',
      title: 'Test Song 2',
      artist: 'Test Artist',
    });
    testSongIds = [song1.id, song2.id];

    // Create test setlist
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;

    // Add songs to setlist
    await setlistSongRepo.addSongs(testSetlistId, testSongIds);

    // Setup Fastify app
    app = Fastify();
    await app.register(jwt, { secret: 'test-secret' });

    app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    app.decorate('requireAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user.isAdmin) {
        reply.status(403).send({ error: 'Admin access required' });
      }
    });

    await app.register(playthroughRoutes, { prefix: '/playthroughs' });
    await app.ready();

    // Create tokens
    userToken = app.jwt.sign({ userId: testUserId, username: 'playthrough_test_user', isAdmin: false });
  });

  beforeEach(async () => {
    // Create a fresh playthrough for each test
    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });
    testPlaythroughId = playthrough.id;

    // Copy songs from setlist to playthrough
    await playthroughSongRepo.copySongsFromSetlist(testPlaythroughId, testSetlistId);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM setlist_songs WHERE setlist_id = $1', [testSetlistId]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM songs WHERE id = ANY($1)', [testSongIds]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await app.close();
  });

  describe('PATCH /playthroughs/:id/advance', () => {
    it('should advance song without requiring a request body', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/playthroughs/${testPlaythroughId}/advance`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        // No body and no Content-Type header
      });

      // Debug: print response if not 200
      if (response.statusCode !== 200) {
        console.log('Response status:', response.statusCode);
        console.log('Response body:', response.body);
      }

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.currentPosition).toBeGreaterThanOrEqual(0);
    });

    it('should reject POST method', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/playthroughs/${testPlaythroughId}/advance`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      // Should be 404 (route not found) since only PATCH is defined
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /playthroughs/:id/summary', () => {
    it('returns complete playthrough summary', async () => {
      // Create second user for multi-player test
      const user2 = await userRepo.create({
        username: `playthrough_test_user2_${Date.now()}`,
        passwordHash: 'hash',
        displayName: 'Test User 2',
        isAdmin: false,
      });

      // Add players to playthrough
      await playthroughPlayerRepo.addPlayer({
        playthroughId: testPlaythroughId,
        userId: testUserId,
        instrument: 'drums',
        difficulty: 'expert',
        isProMode: false,
      });

      await playthroughPlayerRepo.addPlayer({
        playthroughId: testPlaythroughId,
        userId: user2.id,
        instrument: 'guitar',
        difficulty: 'hard',
        isProMode: false,
      });

      // Finish playthrough
      await playthroughRepo.finish(testPlaythroughId);

      // Get playthrough songs
      const songs = await playthroughSongRepo.getSongs(testPlaythroughId);
      expect(songs.length).toBeGreaterThan(0);

      // Create stats for first song
      await playthroughSongStatsRepo.create({
        playthroughSongId: songs[0].id,
        userId: testUserId,
        score: 100000,
        rating: 5,
        accuracyPct: 98.5,
        notesHit: 450,
        notesMissed: 10,
        longestStreak: 200,
        starsEarned: 5,
      });

      await playthroughSongStatsRepo.create({
        playthroughSongId: songs[0].id,
        userId: user2.id,
        score: 90000,
        rating: 4,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/playthroughs/${testPlaythroughId}/summary`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.playthrough.id).toBe(testPlaythroughId);
      expect(body.setlist.name).toBe('Test Setlist');
      expect(body.players).toHaveLength(2);

      // Should have 2 songs from the test setlist
      expect(body.songs).toHaveLength(2);

      // Check first song has ratings and stats
      expect(body.songs[0].position).toBe(0);
      expect(body.songs[0].song.id).toBe(testSongIds[0]);
      expect(body.songs[0].ratings).toHaveLength(2);
      expect(body.songs[0].ratings[0].rating).toBe(5);
      expect(body.songs[0].ratings[1].rating).toBe(4);
      expect(body.songs[0].stats).toHaveLength(2);
      expect(body.songs[0].stats[0].score).toBe(100000);
      expect(body.songs[0].stats[0].username).toBe('playthrough_test_user');
      expect(body.songs[0].stats[1].score).toBe(90000);

      // Second song should have no stats
      expect(body.songs[1].position).toBe(1);
      expect(body.songs[1].ratings).toHaveLength(0);
      expect(body.songs[1].stats).toHaveLength(0);

      // Clean up
      await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
    });

    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/playthroughs/1/summary',
      });

      expect(response.statusCode).toBe(401);
    });

    it('enforces access control (participant or host only)', async () => {
      const otherUser = await userRepo.create({
        username: `playthrough_other_user_${Date.now()}`,
        passwordHash: 'hash',
        displayName: 'Other User',
        isAdmin: false,
      });

      const otherUserToken = app.jwt.sign({
        userId: otherUser.id,
        username: otherUser.username,
        isAdmin: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/playthroughs/${testPlaythroughId}/summary`,
        headers: { authorization: `Bearer ${otherUserToken}` },
      });

      expect(response.statusCode).toBe(403);

      // Clean up
      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });
  });

  describe('PATCH /playthroughs/:id/songs/:position/stats/:userId', () => {
    it('updates stats for a player', async () => {
      // Add player to playthrough
      await playthroughPlayerRepo.addPlayer({
        playthroughId: testPlaythroughId,
        userId: testUserId,
        instrument: 'drums',
        difficulty: 'expert',
        isProMode: false,
      });

      // Finish playthrough
      await playthroughRepo.finish(testPlaythroughId);

      // Get playthrough songs
      const songs = await playthroughSongRepo.getSongs(testPlaythroughId);

      // Create stats for first song
      const stats = await playthroughSongStatsRepo.create({
        playthroughSongId: songs[0].id,
        userId: testUserId,
        score: 100000,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/playthroughs/${testPlaythroughId}/songs/0/stats/${testUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          score: 150000,
          accuracyPct: 99.5,
          starsEarned: 6,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.score).toBe(150000);
      expect(body.accuracyPct).toBe(99.5);
      expect(body.starsEarned).toBe(6);
    });

    it('validates stars earned range (1-6)', async () => {
      // Add player to playthrough
      await playthroughPlayerRepo.addPlayer({
        playthroughId: testPlaythroughId,
        userId: testUserId,
        instrument: 'drums',
        difficulty: 'expert',
        isProMode: false,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/playthroughs/${testPlaythroughId}/songs/0/stats/${testUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { starsEarned: 7 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('validates accuracy range (0-100)', async () => {
      // Add player to playthrough
      await playthroughPlayerRepo.addPlayer({
        playthroughId: testPlaythroughId,
        userId: testUserId,
        instrument: 'drums',
        difficulty: 'expert',
        isProMode: false,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/playthroughs/${testPlaythroughId}/songs/0/stats/${testUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { accuracyPct: 150 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('requires participant authorization', async () => {
      const otherUser = await userRepo.create({
        username: `playthrough_other_user2_${Date.now()}`,
        passwordHash: 'hash',
        displayName: 'Other User',
        isAdmin: false,
      });

      const otherUserToken = app.jwt.sign({
        userId: otherUser.id,
        username: otherUser.username,
        isAdmin: false,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/playthroughs/${testPlaythroughId}/songs/0/stats/${testUserId}`,
        headers: { authorization: `Bearer ${otherUserToken}` },
        payload: { score: 150000 },
      });

      expect(response.statusCode).toBe(403);

      // Clean up
      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });
  });
});
