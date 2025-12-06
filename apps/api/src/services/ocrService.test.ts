import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as ocrService from './ocrService.js';

// Mock dependencies
vi.mock('./gamertagMatcher.js', () => ({
  matchGamertags: vi.fn(),
}));

vi.mock('../repositories/playthroughSongRepository.js', () => ({
  getSongAtPosition: vi.fn(),
  updateOcrStatus: vi.fn(),
  clearPlayerStats: vi.fn(),
}));

vi.mock('../repositories/playthroughSongStatsRepository.js', () => ({
  getForUserAndSong: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../routes/ws-playthroughs.js', () => ({
  connectionManager: {
    broadcast: vi.fn(),
  },
}));

describe('ocrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSolverUrl', () => {
    it('should return default solver URL', () => {
      const url = ocrService.getSolverUrl();
      expect(url).toContain('solver');
      expect(url).toContain('8081');
    });
  });

  describe('processScreenshot', () => {
    it('should handle failed OCR request gracefully', async () => {
      // Mock fetch to reject
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/path/to/screenshot.jpg')
      ).resolves.not.toThrow();
    });

    it('should handle non-200 response gracefully', async () => {
      // Mock fetch to return error response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/path/to/screenshot.jpg')
      ).resolves.not.toThrow();
    });

    it('should handle empty OCR result gracefully', async () => {
      // Mock fetch to return empty result
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            players: [],
            errors: [],
          }),
      });

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/path/to/screenshot.jpg')
      ).resolves.not.toThrow();
    });
  });
});
