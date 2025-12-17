import { test } from '@playwright/test';
import { login } from './helpers/auth';
import { startPlaythrough, verifyPlaythroughStarted } from './helpers/playthroughs';

/**
 * Verification tests for Phase 1 helpers
 * Run with: pnpm test:e2e _verify-helpers
 */

test.describe('Verify Phase 1 Helpers', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can start playthrough with 1 player', async ({ page }) => {
    await startPlaythrough(page, 'Test Setlist', [
      { instrument: 'drums', difficulty: 'expert' }
    ]);

    await verifyPlaythroughStarted(page, {
      expectedPlayerCount: 1
    });
  });

  test('can start playthrough with 2 players', async ({ page }) => {
    await startPlaythrough(page, 'Test Setlist', [
      { instrument: 'drums', difficulty: 'expert' },
      { instrument: 'guitar', difficulty: 'hard' }
    ]);

    await verifyPlaythroughStarted(page, {
      expectedPlayerCount: 2
    });
  });
});
