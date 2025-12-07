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
      expect(url).toContain('8081');
      expect(url).toMatch(/^http/);
    });
  });

  describe('processScreenshot', () => {
    it('should handle failed OCR job submission gracefully', async () => {
      // Mock fetch to reject on job submission
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/workspace/screenshots/test.jpg')
      ).resolves.not.toThrow();
    });

    it('should handle non-200 response on job submission gracefully', async () => {
      // Mock fetch to return error response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/workspace/screenshots/test.jpg')
      ).resolves.not.toThrow();
    });

    it('should handle async OCR job completion', async () => {
      const jobId = 'test-job-123';
      let callCount = 0;

      // Mock fetch for job submission and polling
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        callCount++;

        // First call: submit job
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ job_id: jobId, status: 'pending' }),
          });
        }

        // Subsequent calls: poll for status
        // First poll: still processing
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                job_id: jobId,
                status: 'processing',
                result: null,
              }),
          });
        }

        // Second poll: completed with results
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              job_id: jobId,
              status: 'completed',
              result: {
                success: true,
                players: [{ gamertag: 'TestPlayer', score: 100000 }],
                errors: [],
              },
            }),
        });
      });

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/workspace/screenshots/test.jpg')
      ).resolves.not.toThrow();

      // Should have made 3 calls: submit + 2 polls
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle empty OCR result gracefully', async () => {
      const jobId = 'test-job-456';

      // Mock fetch for immediate completion with empty results
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/ocr/')) {
          // Polling call
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                job_id: jobId,
                status: 'completed',
                result: {
                  success: true,
                  players: [],
                  errors: [],
                },
              }),
          });
        }

        // Job submission
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ job_id: jobId, status: 'pending' }),
        });
      });

      // Should not throw
      await expect(
        ocrService.processScreenshot(1, 1, '/workspace/screenshots/test.jpg')
      ).resolves.not.toThrow();
    });
  });
});
