import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { pool } from '../../db/pool.js';
import * as userRepo from '../../repositories/userRepository.js';
import * as songRepo from '../../repositories/songRepository.js';
import adminSongRoutes from './songs.js';
import type { JwtPayload } from '@bearded-nemesis/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

describe('Admin Song Routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let testSongId: number;
  let testAdminId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create test users
    const admin = await userRepo.create({
      username: 'songroutes_admin',
      passwordHash: 'hash',
      displayName: 'Song Admin',
      isAdmin: true,
    });
    testAdminId = admin.id;

    const user = await userRepo.create({
      username: 'songroutes_user',
      passwordHash: 'hash',
      displayName: 'Song User',
      isAdmin: false,
    });
    testUserId = user.id;

    // Create test song
    const song = await songRepo.create({
      id: 99900,
      slug: 'admin-test-song',
      title: 'Admin Test Song',
      artist: 'Test Artist',
      bpm: 120,
      difficultyDrums: 3,
      difficultyGuitar: 3,
      difficultyBass: 3,
      difficultyVocals: 3,
    });
    testSongId = song.id;

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

    await app.register(adminSongRoutes, { prefix: '/admin/songs' });

    adminToken = app.jwt.sign({
      userId: testAdminId,
      username: 'songroutes_admin',
      isAdmin: true,
    });

    userToken = app.jwt.sign({
      userId: testUserId,
      username: 'songroutes_user',
      isAdmin: false,
    });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM songs WHERE id >= 99900 AND id < 100000');
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['songroutes_%']);
    await app.close();
  });

  it('should update song metadata', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/songs/${testSongId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        bpm: 140,
        youtubeUrl: 'https://youtube.com/watch?v=test',
        genre: 'Rock',
      },
    });

    expect(response.statusCode).toBe(200);
    const song = response.json();
    expect(song.bpm).toBe(140);
    expect(song.youtubeUrl).toBe('https://youtube.com/watch?v=test');
    expect(song.genre).toBe('Rock');
  });

  it('should deny song updates to non-admin users', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/songs/${testSongId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { bpm: 150 },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 for non-existent song', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/songs/999999',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { bpm: 150 },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should bulk update songs', async () => {
    // Create additional test songs
    const song1 = await songRepo.create({
      id: 99901,
      slug: 'bulk-test-1',
      title: 'Bulk Test 1',
      artist: 'Artist 1',
      difficultyDrums: 3,
      difficultyGuitar: 3,
      difficultyBass: 3,
      difficultyVocals: 3,
    });

    const song2 = await songRepo.create({
      id: 99902,
      slug: 'bulk-test-2',
      title: 'Bulk Test 2',
      artist: 'Artist 2',
      difficultyDrums: 3,
      difficultyGuitar: 3,
      difficultyBass: 3,
      difficultyVocals: 3,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/songs/bulk-update',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        songIds: [song1.id, song2.id],
        updates: {
          genre: 'Metal',
          sourceArray: ['DLC Pack 1'],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.updated).toBe(2);

    // Verify updates
    const updated1 = await songRepo.findById(song1.id);
    expect(updated1?.genre).toBe('Metal');
    expect(updated1?.sourceArray).toEqual(['DLC Pack 1']);
  });
});
