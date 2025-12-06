import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as playthroughService from './playthroughService.js';
import * as userRepo from '../repositories/userRepository.js';
import * as setlistRepo from '../repositories/setlistRepository.js';
import * as setlistSongRepo from '../repositories/setlistSongRepository.js';
import type { BuilderPlayer } from '@bearded-nemesis/shared';

describe('playthroughService', () => {
  let testUserId1: number;
  let testUserId2: number;
  let testSetlistId: number;
  const testSongIds = [99940, 99941, 99942];

  beforeAll(async () => {
    const user1 = await userRepo.create({
      username: 'ptservicetest1',
      passwordHash: 'hash',
      displayName: 'PT Service Test 1',
    });
    testUserId1 = user1.id;

    const user2 = await userRepo.create({
      username: 'ptservicetest2',
      passwordHash: 'hash',
      displayName: 'PT Service Test 2',
    });
    testUserId2 = user2.id;

    // Create test songs
    for (const songId of testSongIds) {
      await pool.query(
        `INSERT INTO songs (id, slug, title, artist, difficulty_drums)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [songId, `pt-service-song-${songId}`, `PT Service Song ${songId}`, 'Test', 3]
      );
    }

    const setlist = await setlistRepo.create({
      userId: testUserId1,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;

    await setlistSongRepo.addSongs(testSetlistId, testSongIds);
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by IN ($1, $2)', [
      testUserId1,
      testUserId2,
    ]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by IN ($1, $2)', [
      testUserId1,
      testUserId2,
    ]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId1]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId1, testUserId2]);
    for (const songId of testSongIds) {
      await pool.query('DELETE FROM songs WHERE id = $1', [songId]);
    }
    await pool.end();
  });

  it('should create playthrough with players and songs', async () => {
    const players: BuilderPlayer[] = [
      {
        userId: testUserId1,
        instrument: 'drums',
        difficulty: 'expert',
        proMode: false,
      },
      {
        userId: testUserId2,
        instrument: 'guitar',
        difficulty: 'hard',
        proMode: false,
      },
    ];

    const result = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    expect(result.playthrough.id).toBeDefined();
    expect(result.playthrough.createdBy).toBe(testUserId1);
    expect(result.players.length).toBe(2);
    expect(result.songs.length).toBe(testSongIds.length);
  });

  it('should not allow creating playthrough from empty setlist', async () => {
    const emptySetlist = await setlistRepo.create({
      userId: testUserId1,
      name: 'Empty Setlist',
      type: 'manual',
    });

    await expect(
      playthroughService.createPlaythrough(testUserId1, emptySetlist.id, [])
    ).rejects.toThrow('Cannot create playthrough from empty setlist');

    await pool.query('DELETE FROM setlists WHERE id = $1', [emptySetlist.id]);
  });

  it('should advance to next song', async () => {
    const players: BuilderPlayer[] = [
      { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];

    const { playthrough } = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    const advanced = await playthroughService.advanceToNextSong(playthrough.id);
    expect(advanced?.currentPosition).toBe(1);
  });

  it('should not advance past end of setlist', async () => {
    const players: BuilderPlayer[] = [
      { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];

    const { playthrough } = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    // Advance to last song
    await playthroughService.advanceToNextSong(playthrough.id);
    await playthroughService.advanceToNextSong(playthrough.id);

    // Try to advance past end
    const result = await playthroughService.advanceToNextSong(playthrough.id);
    expect(result).toBeNull();
  });

  it('should go back to previous song', async () => {
    const players: BuilderPlayer[] = [
      { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];

    const { playthrough } = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    await playthroughService.advanceToNextSong(playthrough.id);
    await playthroughService.advanceToNextSong(playthrough.id);

    const previous = await playthroughService.goBackToPreviousSong(playthrough.id);
    expect(previous?.currentPosition).toBe(1);
  });

  it('should not go back before start', async () => {
    const players: BuilderPlayer[] = [
      { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];

    const { playthrough } = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    const result = await playthroughService.goBackToPreviousSong(playthrough.id);
    expect(result).toBeNull();
  });

  it('should submit rating for player', async () => {
    const players: BuilderPlayer[] = [
      { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];

    const { playthrough } = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    const stats = await playthroughService.submitRating(
      playthrough.id,
      testUserId1,
      0, // position
      4 // rating
    );

    expect(stats.rating).toBe(4);
    expect(stats.userId).toBe(testUserId1);
  });

  it('should finish playthrough', async () => {
    const players: BuilderPlayer[] = [
      { userId: testUserId1, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];

    const { playthrough } = await playthroughService.createPlaythrough(
      testUserId1,
      testSetlistId,
      players
    );

    const finished = await playthroughService.finishPlaythrough(playthrough.id);
    expect(finished?.status).toBe('finished');
    expect(finished?.finishedAt).toBeInstanceOf(Date);
  });
});
