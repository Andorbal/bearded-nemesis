import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as setlistRepo from './setlistRepository.js';
import * as userRepo from './userRepository.js';

describe('setlistRepository', () => {
  let testUserId: number;

  beforeAll(async () => {
    const user = await userRepo.create({
      username: 'setlisttest',
      passwordHash: 'hash',
      displayName: 'Setlist Test',
    });
    testUserId = user.id;
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  it('should create a manual setlist', async () => {
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'My Setlist',
      type: 'manual',
    });

    expect(setlist.id).toBeDefined();
    expect(setlist.name).toBe('My Setlist');
    expect(setlist.type).toBe('manual');
  });

  it('should create a smart setlist with filter', async () => {
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Hard Songs',
      type: 'smart',
      smartFilter: {
        minDifficulty: 5,
        maxDifficulty: 7,
        instruments: ['drums'],
        ownedOnly: true,
      },
    });

    expect(setlist.id).toBeDefined();
    expect(setlist.type).toBe('smart');
    expect(setlist.smartFilter?.minDifficulty).toBe(5);
  });

  it('should find setlist by id', async () => {
    const created = await setlistRepo.create({
      userId: testUserId,
      name: 'Find Me',
      type: 'manual',
    });

    const found = await setlistRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Find Me');
  });

  it('should list setlists for user', async () => {
    await setlistRepo.create({ userId: testUserId, name: 'Setlist 1', type: 'manual' });
    await setlistRepo.create({ userId: testUserId, name: 'Setlist 2', type: 'manual' });

    const setlists = await setlistRepo.findByUserId(testUserId);
    expect(setlists.length).toBe(2);
  });

  it('should update setlist', async () => {
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Original',
      type: 'manual',
    });

    const updated = await setlistRepo.update(setlist.id, { name: 'Updated' });
    expect(updated?.name).toBe('Updated');
  });

  it('should delete setlist', async () => {
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'Delete Me',
      type: 'manual',
    });

    const deleted = await setlistRepo.remove(setlist.id);
    expect(deleted).toBe(true);

    const found = await setlistRepo.findById(setlist.id);
    expect(found).toBeNull();
  });
});
