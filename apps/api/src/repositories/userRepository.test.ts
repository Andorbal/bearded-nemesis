import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as userRepo from './userRepository.js';

describe('userRepository', () => {
  beforeAll(async () => {
    // Ensure test database is migrated
  });

  beforeEach(async () => {
    // Clean up only users created by this test suite
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['userrepotest_%']);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create a user', async () => {
    const user = await userRepo.create({
      username: 'userrepotest_testuser',
      passwordHash: 'hashedpassword',
      displayName: 'Test User',
      xboxGamertag: 'TestGamer',
      isAdmin: false,
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe('userrepotest_testuser');
    expect(user.displayName).toBe('Test User');
  });

  it('should find user by username', async () => {
    await userRepo.create({
      username: 'userrepotest_findme',
      passwordHash: 'hash',
      displayName: 'Find Me',
    });

    const user = await userRepo.findByUsername('userrepotest_findme');
    expect(user).not.toBeNull();
    expect(user?.username).toBe('userrepotest_findme');
  });

  it('should return null for non-existent user', async () => {
    const user = await userRepo.findByUsername('nonexistent');
    expect(user).toBeNull();
  });

  it('should not find soft-deleted users', async () => {
    const user = await userRepo.create({
      username: 'userrepotest_deleted',
      passwordHash: 'hash',
      displayName: 'Deleted User',
    });

    await userRepo.softDelete(user.id);

    const found = await userRepo.findByUsername('userrepotest_deleted');
    expect(found).toBeNull();
  });

  it('should list all users including deleted ones when requested', async () => {
    const user1 = await userRepo.create({
      username: 'userrepotest_active',
      passwordHash: 'hash',
      displayName: 'Active User',
    });

    const user2 = await userRepo.create({
      username: 'userrepotest_softdeleted',
      passwordHash: 'hash',
      displayName: 'Deleted User',
    });

    // Soft delete user2
    await userRepo.softDelete(user2.id);

    // findAll should not include deleted
    const activeUsers = await userRepo.findAll();
    expect(activeUsers.some(u => u.id === user2.id)).toBe(false);

    // findAllIncludingDeleted should include deleted
    const allUsers = await userRepo.findAllIncludingDeleted();
    expect(allUsers.some(u => u.id === user2.id)).toBe(true);
    expect(allUsers.find(u => u.id === user2.id)?.deletedAt).not.toBeNull();
  });

  it('should restore a soft-deleted user', async () => {
    const user = await userRepo.create({
      username: 'userrepotest_restore',
      passwordHash: 'hash',
      displayName: 'Restore Test',
    });

    // Soft delete
    const deleted = await userRepo.softDelete(user.id);
    expect(deleted).toBe(true);

    // Verify deleted
    const deletedUser = await userRepo.findById(user.id);
    expect(deletedUser).toBeNull();

    // Restore
    const restored = await userRepo.restore(user.id);
    expect(restored).toBe(true);

    // Verify restored
    const restoredUser = await userRepo.findById(user.id);
    expect(restoredUser).not.toBeNull();
    expect(restoredUser?.deletedAt).toBeNull();
  });

  it('should count admin users', async () => {
    const admin1 = await userRepo.create({
      username: 'userrepotest_admin1',
      passwordHash: 'hash',
      displayName: 'Admin 1',
      isAdmin: true,
    });

    const admin2 = await userRepo.create({
      username: 'userrepotest_admin2',
      passwordHash: 'hash',
      displayName: 'Admin 2',
      isAdmin: true,
    });

    const regularUser = await userRepo.create({
      username: 'userrepotest_regular',
      passwordHash: 'hash',
      displayName: 'Regular User',
      isAdmin: false,
    });

    const count = await userRepo.countAdmins();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
