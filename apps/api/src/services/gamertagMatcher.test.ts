import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as gamertagMatcher from './gamertagMatcher.js';
import * as userRepo from '../repositories/userRepository.js';
import { pool } from '../db/pool.js';
import { hashPassword } from '../utils/password.js';

describe('gamertagMatcher', () => {
  const testUserIds: number[] = [];

  beforeAll(async () => {
    // Create test users with gamertags
    const user1 = await userRepo.create({
      username: `gttest1_${Date.now()}`,
      passwordHash: await hashPassword('test'),
      displayName: 'Test User 1',
      xboxGamertag: 'Andorbal',
    });
    testUserIds.push(user1.id);

    const user2 = await userRepo.create({
      username: `gttest2_${Date.now()}`,
      passwordHash: await hashPassword('test'),
      displayName: 'Test User 2',
      xboxGamertag: 'RockStar99',
    });
    testUserIds.push(user2.id);

    const user3 = await userRepo.create({
      username: `gttest3_${Date.now()}`,
      passwordHash: await hashPassword('test'),
      displayName: 'Test User 3',
      xboxGamertag: 'DrumMaster',
    });
    testUserIds.push(user3.id);
  });

  afterAll(async () => {
    for (const id of testUserIds) {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    }
    await pool.end();
  });

  describe('findUserByGamertag', () => {
    it('should match exact gamertag', async () => {
      const match = await gamertagMatcher.findUserByGamertag('Andorbal');

      expect(match).not.toBeNull();
      expect(match?.xboxGamertag).toBe('Andorbal');
    });

    it('should match case-insensitive', async () => {
      const match = await gamertagMatcher.findUserByGamertag('andorbal');

      expect(match).not.toBeNull();
      expect(match?.xboxGamertag).toBe('Andorbal');
    });

    it('should match with OCR error 0->o', async () => {
      // OCR might read 'o' as '0'
      const match = await gamertagMatcher.findUserByGamertag('And0rbal');

      expect(match).not.toBeNull();
      expect(match?.xboxGamertag).toBe('Andorbal');
    });

    it('should match with OCR error 1->l', async () => {
      // OCR might read 'l' as '1'
      const match = await gamertagMatcher.findUserByGamertag('Andorba1');

      expect(match).not.toBeNull();
      expect(match?.xboxGamertag).toBe('Andorbal');
    });

    it('should match with multiple OCR errors', async () => {
      const match = await gamertagMatcher.findUserByGamertag('And0rba1');

      expect(match).not.toBeNull();
      expect(match?.xboxGamertag).toBe('Andorbal');
    });

    it('should match with minor typo', async () => {
      const match = await gamertagMatcher.findUserByGamertag('Andorbel');

      expect(match).not.toBeNull();
      expect(match?.xboxGamertag).toBe('Andorbal');
    });

    it('should return null for no match', async () => {
      const match = await gamertagMatcher.findUserByGamertag('CompletelyDifferent');

      expect(match).toBeNull();
    });

    it('should return null for empty string', async () => {
      const match = await gamertagMatcher.findUserByGamertag('');

      expect(match).toBeNull();
    });
  });

  describe('matchGamertags', () => {
    it('should match multiple gamertags', async () => {
      const extracted = ['Andorbal', 'RockStar99', 'DrumMaster'];
      const matches = await gamertagMatcher.matchGamertags(extracted);

      expect(matches).toHaveLength(3);
      expect(matches[0]?.xboxGamertag).toBe('Andorbal');
      expect(matches[1]?.xboxGamertag).toBe('RockStar99');
      expect(matches[2]?.xboxGamertag).toBe('DrumMaster');
    });

    it('should handle OCR errors in multiple gamertags', async () => {
      const extracted = ['And0rbal', 'R0ckStar99', 'DrumMa5ter'];
      const matches = await gamertagMatcher.matchGamertags(extracted);

      expect(matches).toHaveLength(3);
      expect(matches[0]?.xboxGamertag).toBe('Andorbal');
      expect(matches[1]?.xboxGamertag).toBe('RockStar99');
      expect(matches[2]?.xboxGamertag).toBe('DrumMaster');
    });

    it('should handle unmatched gamertags', async () => {
      const extracted = ['Andorbal', 'UnknownPlayer', 'RockStar99'];
      const matches = await gamertagMatcher.matchGamertags(extracted);

      expect(matches).toHaveLength(3);
      expect(matches[0]).not.toBeNull();
      expect(matches[1]).toBeNull();
      expect(matches[2]).not.toBeNull();
    });

    it('should handle empty array', async () => {
      const matches = await gamertagMatcher.matchGamertags([]);

      expect(matches).toHaveLength(0);
    });
  });

  describe('getSimilarityThreshold', () => {
    it('should return threshold between 0 and 1', () => {
      const threshold = gamertagMatcher.getSimilarityThreshold();

      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });
  });
});
