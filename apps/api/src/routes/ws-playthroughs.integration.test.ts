/**
 * WebSocket Integration Tests
 *
 * These tests require the API server to be running on localhost:3001.
 * They are marked as skipped by default and should be run manually:
 *
 * 1. Start API: pnpm --filter @bearded-nemesis/api dev
 * 2. Remove .skip from tests
 * 3. Run tests: pnpm --filter @bearded-nemesis/api test ws-playthroughs.integration
 *
 * In production, these would be run in a CI environment with services started.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, type TestContext } from 'vitest';
import WebSocket, { type RawData } from 'ws';
import { pool } from '../db/pool.js';
import * as userRepo from '../repositories/userRepository.js';
import * as setlistRepo from '../repositories/setlistRepository.js';
import * as setlistSongRepo from '../repositories/setlistSongRepository.js';
import * as playthroughService from '../services/playthroughService.js';
import type { WsServerMessage, BuilderPlayer } from '@bearded-nemesis/shared';

// Helper to run test with done callback
function withDone(fn: (done: (err?: Error) => void) => void): () => Promise<void> {
  return () => new Promise((resolve, reject) => {
    fn((err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// NOTE: This test requires the API server to be running
// Run with: pnpm run dev (in one terminal), then pnpm test (in another)

const API_WS_URL = 'ws://localhost:3001';

describe('WebSocket Playthrough Integration', () => {
  let testUserId: number;
  let testSetlistId: number;
  let testPlaythroughId: number;
  let testToken = ''; // Placeholder - tests are skipped, would be set via login endpoint in real test
  const testSongIds = [1, 2, 3]; // Assuming these exist from seed data

  beforeAll(async () => {
    // Create test user
    const user = await userRepo.create({
      username: 'wsintegrationtest',
      passwordHash: 'hash',
      displayName: 'WS Integration Test',
    });
    testUserId = user.id;

    // Create setlist with songs
    const setlist = await setlistRepo.create({
      userId: testUserId,
      name: 'WS Test Setlist',
      type: 'manual',
    });
    testSetlistId = setlist.id;
    await setlistSongRepo.addSongs(testSetlistId, testSongIds);

    // Generate mock JWT token (in real test, call login endpoint)
    // For this example, we'll skip token generation
    // In production tests, you'd call the /auth/login endpoint
  });

  beforeEach(async () => {
    // Clean up old playthroughs
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);

    // Create fresh playthrough
    const players: BuilderPlayer[] = [
      { userId: testUserId, instrument: 'drums', difficulty: 'expert', proMode: false },
    ];
    const result = await playthroughService.createPlaythrough(testUserId, testSetlistId, players);
    testPlaythroughId = result.playthrough.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM playthroughs WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM setlists WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  it.skip('should connect and receive state_sync', withDone((done) => {
    // Skip this test in CI or when API server is not running
    const ws = new WebSocket(
      `${API_WS_URL}/playthroughs/${testPlaythroughId}/live?token=${testToken}`
    );

    ws.on('open', () => {
      console.log('[TEST] WebSocket connected');
    });

    ws.on('message', (data: RawData) => {
      const message: WsServerMessage = JSON.parse(data.toString());

      if (message.type === 'state_sync') {
        expect(message.state.playthroughId).toBe(testPlaythroughId);
        expect(message.state.currentPosition).toBe(0);
        expect(message.state.songs.length).toBe(testSongIds.length);
        ws.close();
        done();
      }
    });

    ws.on('error', (err: Error) => {
      console.error('[TEST] WebSocket error:', err);
      done(err);
    });
  }), 10000);

  it.skip('should receive rating_submitted broadcast', withDone((done) => {
    const ws = new WebSocket(
      `${API_WS_URL}/playthroughs/${testPlaythroughId}/live?token=${testToken}`
    );

    ws.on('open', () => {
      // Submit rating via WebSocket
      ws.send(JSON.stringify({ type: 'submit_rating', rating: 5 }));
    });

    ws.on('message', (data: RawData) => {
      const message: WsServerMessage = JSON.parse(data.toString());

      if (message.type === 'rating_submitted') {
        expect(message.rating).toBe(5);
        ws.close();
        done();
      }
    });

    ws.on('error', (err: Error) => {
      done(err);
    });
  }), 10000);

  it.skip('should reject connection without auth token', withDone((done) => {
    const ws = new WebSocket(
      `${API_WS_URL}/playthroughs/${testPlaythroughId}/live`
    );

    ws.on('close', (code: number, reason: Buffer) => {
      expect(code).toBe(1008);
      expect(reason.toString()).toContain('Authentication required');
      done();
    });

    ws.on('error', () => {
      // Expected for auth failure
    });
  }), 10000);

  it.skip('should reject connection with invalid token', withDone((done) => {
    const ws = new WebSocket(
      `${API_WS_URL}/playthroughs/${testPlaythroughId}/live?token=invalid-token`
    );

    ws.on('close', (code: number, reason: Buffer) => {
      expect(code).toBe(1008);
      expect(reason.toString()).toContain('Invalid token');
      done();
    });

    ws.on('error', () => {
      // Expected for auth failure
    });
  }), 10000);

  it.skip('should reject connection to non-existent playthrough', withDone((done) => {
    const ws = new WebSocket(
      `${API_WS_URL}/playthroughs/99999/live?token=${testToken}`
    );

    ws.on('close', (code: number, reason: Buffer) => {
      expect(code).toBe(1008);
      expect(reason.toString()).toContain('Playthrough not found');
      done();
    });

    ws.on('error', () => {
      // Expected
    });
  }), 10000);
});
