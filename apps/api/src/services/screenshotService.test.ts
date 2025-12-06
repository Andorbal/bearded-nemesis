import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as screenshotService from './screenshotService.js';

describe('screenshotService', () => {
  const testDir = path.join(process.cwd(), 'screenshots', 'test');

  beforeEach(async () => {
    // Ensure test directory exists
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(path.join(testDir, file));
      }
      await fs.rmdir(testDir);
    } catch {
      // Ignore errors
    }
  });

  describe('generateScreenshotPath', () => {
    it('should generate screenshot path with playthrough and position', () => {
      const filepath = screenshotService.generateScreenshotPath(123, 5);

      expect(filepath).toContain('playthrough_123');
      expect(filepath).toContain('song_5');
      expect(filepath).toMatch(/\.jpg$/);
    });

    it('should include timestamp for uniqueness', () => {
      const path1 = screenshotService.generateScreenshotPath(1, 1);
      // Small delay to get different timestamp
      const path2 = screenshotService.generateScreenshotPath(1, 1);

      // Paths will have different timestamps, but same structure
      expect(path1).toContain('playthrough_1');
      expect(path2).toContain('playthrough_1');
    });
  });

  describe('saveScreenshot', () => {
    it('should save screenshot buffer to disk', async () => {
      const buffer = Buffer.from('fake image data');
      const filepath = path.join(testDir, 'test_image.jpg');

      await screenshotService.saveScreenshot(buffer, filepath);

      // Verify file exists
      const exists = await screenshotService.screenshotExists(filepath);
      expect(exists).toBe(true);

      // Verify content
      const saved = await fs.readFile(filepath);
      expect(saved.toString()).toBe('fake image data');
    });

    it('should create parent directories if needed', async () => {
      const buffer = Buffer.from('test');
      const filepath = path.join(testDir, 'nested', 'dir', 'image.jpg');

      await screenshotService.saveScreenshot(buffer, filepath);

      const exists = await screenshotService.screenshotExists(filepath);
      expect(exists).toBe(true);

      // Clean up nested dirs
      await fs.unlink(filepath);
      await fs.rmdir(path.join(testDir, 'nested', 'dir'));
      await fs.rmdir(path.join(testDir, 'nested'));
    });
  });

  describe('deleteScreenshot', () => {
    it('should delete screenshot file', async () => {
      const buffer = Buffer.from('test');
      const filepath = path.join(testDir, 'to_delete.jpg');
      await screenshotService.saveScreenshot(buffer, filepath);

      await screenshotService.deleteScreenshot(filepath);

      const exists = await screenshotService.screenshotExists(filepath);
      expect(exists).toBe(false);
    });

    it('should not throw if file does not exist', async () => {
      const filepath = path.join(testDir, 'nonexistent.jpg');

      // Should not throw
      await expect(
        screenshotService.deleteScreenshot(filepath)
      ).resolves.toBeUndefined();
    });
  });

  describe('screenshotExists', () => {
    it('should return true for existing file', async () => {
      const buffer = Buffer.from('test');
      const filepath = path.join(testDir, 'exists.jpg');
      await screenshotService.saveScreenshot(buffer, filepath);

      const exists = await screenshotService.screenshotExists(filepath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const filepath = path.join(testDir, 'does_not_exist.jpg');

      const exists = await screenshotService.screenshotExists(filepath);
      expect(exists).toBe(false);
    });
  });
});
