import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createTestSetlist } from './helpers/setlists';
import { startPlaythrough, verifyPlaythroughStarted } from './helpers/playthroughs';

test.describe('Playthrough Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can start playthrough with single player', async ({ page }) => {
    // Create test setlist using helper
    const setlist = await createTestSetlist(page);

    // Navigate directly to playthrough start
    await page.goto('/playthroughs/new');

    // Use helper to start playthrough with 1 player
    await startPlaythrough(page, setlist.name, [
      { instrument: 'guitar', difficulty: 'hard' }
    ]);

    // Verify playthrough started
    await verifyPlaythroughStarted(page, {
      expectedPlayerCount: 1
    });
  });

  test('can start playthrough with two players', async ({ page }) => {
    // Create test setlist
    const setlist = await createTestSetlist(page);
    await page.goto('/playthroughs/new');

    // Start with 2 players using helper
    await startPlaythrough(page, setlist.name, [
      { instrument: 'drums', difficulty: 'expert' },
      { instrument: 'guitar', difficulty: 'hard' }
    ]);

    // Verify both players appear
    await verifyPlaythroughStarted(page, {
      expectedPlayerCount: 2
    });

    // Verify both instruments are shown
    const drumText = page.locator('text=/drums/i').or(page.locator('[data-testid="player-0-instrument"]:has-text("drums")'));
    await expect(drumText.first()).toBeVisible();

    const guitarText = page.locator('text=/guitar/i').or(page.locator('[data-testid="player-1-instrument"]:has-text("guitar")'));
    await expect(guitarText.first()).toBeVisible();
  });

  test('cannot start playthrough without selecting setlist', async ({ page }) => {
    await page.goto('/playthroughs/new');

    // Try to select instrument/difficulty without setlist
    const selectElements = page.locator('select');

    // Skip setlist dropdown (index 0), select instrument and difficulty
    if (await selectElements.count() >= 3) {
      await selectElements.nth(1).selectOption('drums');
      await selectElements.nth(2).selectOption('expert');
    }

    // Try to start
    const startButton = page.locator('button:has-text("Start Playthrough")');

    // Check if button is disabled
    const isDisabled = await startButton.isDisabled();

    if (isDisabled) {
      // Button should be disabled without setlist selection
      expect(isDisabled).toBe(true);
    } else {
      // If not disabled, clicking should show error
      await startButton.click();

      // Verify error message appears
      const errorLocator = page.locator('text=/select.*setlist/i, text=/setlist.*required/i, text=/required/i, .error');
      await expect(errorLocator.first()).toBeVisible({ timeout: 3000 });

      // Verify we're still on the start page
      await expect(page).toHaveURL(/\/playthroughs\/(start|new)/);
    }
  });
});
