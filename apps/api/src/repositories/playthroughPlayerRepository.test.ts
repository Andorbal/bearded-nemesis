import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as playthroughPlayerRepo from './playthroughPlayerRepository.js';
import * as playthroughRepo from './playthroughRepository.js';
import * as userRepo from './userRepository.js';
import * as setlistRepo from './setlistRepository.js';

describe('playthroughPlayerRepository', () => {
  let testUserId1: number;
  let testUserId2: number;
  let testSetlistId: number;
  let testPlaythroughId: number;

  beforeAll(async () => {
    const user1 = await userRepo.create({
      username: 'ptplayertest1',
      passwordHash: 'hash',
      displayName: 'PT Player Test 1',
    });
    testUserId1 = user1.id;

    const user2 = await userRepo.create({
      username: 'ptplayertest2',
      passwordHash: 'hash',
      displayName: 'PT Player Test 2',
    });
    testUserId2 = user2.id;

    const setlist = await setlistRepo.create({
      userId: testUserId1,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;
  });

  beforeEach(async () => {
    // Clean up old playthroughs
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId1]);

    // Create fresh playthrough for each test
    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId1,
    });
    testPlaythroughId = playthrough.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId1]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId1]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId1, testUserId2]);
    await pool.end();
  });

  it('should add player to playthrough', async () => {
    const player = await playthroughPlayerRepo.addPlayer({
      playthroughId: testPlaythroughId,
      userId: testUserId1,
      instrument: 'drums',
      difficulty: 'expert',
      isProMode: false,
    });

    expect(player.playthroughId).toBe(testPlaythroughId);
    expect(player.userId).toBe(testUserId1);
    expect(player.instrument).toBe('drums');
    expect(player.difficulty).toBe('expert');
    expect(player.isProMode).toBe(false);
  });

  it('should get all players for a playthrough', async () => {
    await playthroughPlayerRepo.addPlayer({
      playthroughId: testPlaythroughId,
      userId: testUserId1,
      instrument: 'drums',
      difficulty: 'expert',
      isProMode: false,
    });

    await playthroughPlayerRepo.addPlayer({
      playthroughId: testPlaythroughId,
      userId: testUserId2,
      instrument: 'guitar',
      difficulty: 'hard',
      isProMode: false,
    });

    const players = await playthroughPlayerRepo.getPlayers(testPlaythroughId);
    expect(players.length).toBe(2);
    expect(players.find(p => p.userId === testUserId1)).toBeDefined();
    expect(players.find(p => p.userId === testUserId2)).toBeDefined();
  });

  it('should not allow duplicate player entries', async () => {
    await playthroughPlayerRepo.addPlayer({
      playthroughId: testPlaythroughId,
      userId: testUserId1,
      instrument: 'drums',
      difficulty: 'expert',
      isProMode: false,
    });

    // Attempting to add same user should fail or update
    await expect(
      playthroughPlayerRepo.addPlayer({
        playthroughId: testPlaythroughId,
        userId: testUserId1,
        instrument: 'guitar',
        difficulty: 'medium',
        isProMode: true,
      })
    ).rejects.toThrow();
  });

  it('should check if user is in playthrough', async () => {
    await playthroughPlayerRepo.addPlayer({
      playthroughId: testPlaythroughId,
      userId: testUserId1,
      instrument: 'drums',
      difficulty: 'expert',
      isProMode: false,
    });

    const isPlayer = await playthroughPlayerRepo.isPlayer(testPlaythroughId, testUserId1);
    expect(isPlayer).toBe(true);

    const notPlayer = await playthroughPlayerRepo.isPlayer(testPlaythroughId, 99999);
    expect(notPlayer).toBe(false);
  });
});
