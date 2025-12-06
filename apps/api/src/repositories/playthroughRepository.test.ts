import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as playthroughRepo from './playthroughRepository.js';
import * as userRepo from './userRepository.js';
import * as setlistRepo from './setlistRepository.js';

describe('playthroughRepository', () => {
  let testUserId: number;
  let testSetlistId: number;

  beforeAll(async () => {
    const user = await userRepo.create({
      username: 'playthroughtest',
      passwordHash: 'hash',
      displayName: 'Playthrough Test',
    });
    testUserId = user.id;

    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  it('should create a playthrough', async () => {
    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    expect(playthrough.id).toBeDefined();
    expect(playthrough.setlistId).toBe(testSetlistId);
    expect(playthrough.createdBy).toBe(testUserId);
    expect(playthrough.status).toBe('in_progress');
    expect(playthrough.currentPosition).toBe(0);
    expect(playthrough.startedAt).toBeInstanceOf(Date);
    expect(playthrough.finishedAt).toBeNull();
  });

  it('should find playthrough by id', async () => {
    const created = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    const found = await playthroughRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it('should list playthroughs for user', async () => {
    await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });
    await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    const playthroughs = await playthroughRepo.findByUser(testUserId);
    expect(playthroughs.length).toBeGreaterThanOrEqual(2);
  });

  it('should find active playthroughs', async () => {
    const active = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    const activeList = await playthroughRepo.findActive();
    expect(activeList.some(p => p.id === active.id)).toBe(true);
  });

  it('should update current position', async () => {
    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    const updated = await playthroughRepo.updatePosition(playthrough.id, 3);
    expect(updated?.currentPosition).toBe(3);
  });

  it('should finish playthrough', async () => {
    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    const finished = await playthroughRepo.finish(playthrough.id);
    expect(finished?.status).toBe('finished');
    expect(finished?.finishedAt).toBeInstanceOf(Date);
  });

  it('should not allow negative position', async () => {
    const playthrough = await playthroughRepo.create({
      setlistId: testSetlistId,
      createdBy: testUserId,
    });

    const updated = await playthroughRepo.updatePosition(playthrough.id, -1);
    expect(updated).toBeNull();
  });
});
