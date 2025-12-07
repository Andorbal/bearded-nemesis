import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { pool } from '../db/pool.js';
import * as userRepo from '../repositories/userRepository.js';
import * as setlistRepo from '../repositories/setlistRepository.js';
import * as setlistSongRepo from '../repositories/setlistSongRepository.js';
import * as songRepo from '../repositories/songRepository.js';
import * as playthroughRepo from '../repositories/playthroughRepository.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
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

    app.decorate('authenticate', async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    app.decorate('requireAdmin', async function (request, reply) {
      if (!request.user.isAdmin) {
        reply.status(403).send({ error: 'Admin access required' });
      }
    });

    await app.register(playthroughRoutes, { prefix: '/playthroughs' });
    await app.ready();

    // Create tokens
    userToken = app.jwt.sign({ userId: testUserId, isAdmin: false });
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
});
