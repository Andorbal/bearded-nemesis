import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helpers - Playthrough Operations
 */

export interface PlayerConfig {
  instrument: 'drums' | 'guitar' | 'bass' | 'vocals';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  proMode?: boolean;
}

/**
 * Start a playthrough with specified setlist and players
 *
 * @param page - Playwright page object
 * @param setlistName - Name of the setlist to select
 * @param players - Array of player configurations (defaults to 1 player: drums/expert)
 */
export async function startPlaythrough(
  page: Page,
  setlistName: string,
  players: PlayerConfig[] = [{ instrument: 'drums', difficulty: 'expert' }]
) {
  // Navigate to new playthrough page
  await page.goto('/playthroughs/new');
  await page.waitForLoadState('networkidle');

  // Select setlist from dropdown
  await page.selectOption('#setlist', { label: setlistName });

  // Wait for player form to appear
  await page.waitForSelector('text=Instrument');

  // Get all instrument and difficulty selects (skipping the setlist select)
  // Strategy: Find all selects, filter out the setlist one (#setlist)
  const allSelects = page.locator('select').all();

  // Configure each player
  for (let i = 0; i < players.length; i++) {
    if (i > 0) {
      // Add player for indices > 0
      await page.click('button:has-text("+ Add Player")');
      await page.waitForTimeout(500); // Wait for UI update
    }

    // Each player has 2 selects: instrument and difficulty
    // Setlist is select 0, then player 0 has selects 1 & 2, player 1 has selects 3 & 4, etc.
    const instrumentSelectIndex = 1 + (i * 2);
    const difficultySelectIndex = 2 + (i * 2);

    const instrumentSelect = page.locator('select').nth(instrumentSelectIndex);
    const difficultySelect = page.locator('select').nth(difficultySelectIndex);

    // Wait for selects to have options before trying to select
    await instrumentSelect.waitFor({ state: 'attached' });
    await difficultySelect.waitFor({ state: 'attached' });

    // Wait a bit for options to populate
    await page.waitForTimeout(300);

    await instrumentSelect.selectOption(players[i].instrument);
    await difficultySelect.selectOption(players[i].difficulty);

    if (players[i].proMode) {
      // Find the pro mode checkbox for this player
      const proModeCheckbox = page.locator('input[type="checkbox"]').nth(i);
      await proModeCheckbox.check();
    }
  }

  // Click "Start Playthrough" button and wait for navigation
  await Promise.all([
    page.waitForURL(/\/playthroughs\/\d+/),
    page.click('button:has-text("Start Playthrough")')
  ]);

  // Wait for playthrough page to fully load
  await page.waitForLoadState('networkidle');

  // Wait for WebSocket connection and UI to be ready
  await expect(page.locator('text=Connected')).toBeVisible();
  await expect(page.locator('text=Rate This Song')).toBeVisible();
}

/**
 * Verify that a playthrough has started successfully
 *
 * @param page - Playwright page object
 * @param options - Verification options (expected song title, player count)
 */
export async function verifyPlaythroughStarted(page: Page, options: {
  expectedSongTitle?: string;
  expectedPlayerCount?: number;
} = {}) {
  // Check URL is active playthrough
  await expect(page).toHaveURL(/\/playthroughs\/\d+/);

  // Wait for playthrough page to fully load
  await page.waitForLoadState('networkidle');

  // Check "Connected" status indicator (WebSocket connection)
  await expect(page.locator('text=Connected')).toBeVisible();

  // Check rating UI exists
  await expect(page.locator('text=Rate This Song')).toBeVisible();

  // Verify song title is displayed (any h1 or h2)
  await expect(page.locator('h1, h2').first()).toBeVisible();

  // Player count verification is optional for now
  // The UI displays player info but we'll skip detailed verification in Phase 1
}

// ===== Functions for stats entry (from paused branch) =====
// These are kept for compatibility with the paused stats entry tests

export async function rateSong(page: Page, rating: number) {
  // Find the rating section by the "Rate This Song" text
  const ratingSection = page.locator('text=Rate This Song').locator('..');
  const stars = ratingSection.locator('button[type="button"]');

  // Click the nth star (1-indexed)
  await stars.nth(rating - 1).click();
}

/**
 * Helper to find an input field by its label text
 * Works with NumberInput component that doesn't use for/id association
 */
export function getInputByLabel(page: Page | ReturnType<Page['locator']>, labelText: string) {
  // Find the label containing the text, then get its parent (the NumberInput wrapper), and find the input inside
  return page.locator(`label:has-text("${labelText}")`).locator('..').locator('input');
}

/**
 * Helper to find a select field by its label text
 */
export function getSelectByLabel(page: Page | ReturnType<Page['locator']>, labelText: string) {
  return page.locator(`label:has-text("${labelText}")`).locator('..').locator('select');
}

export async function enterStats(page: Page, stats: {
  completion?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  score?: number;
  stars?: number;
  gold?: boolean;
  longestStreak?: number;
  notesHit?: number;
  notesMissed?: number;
  avgMultiplier?: number;
}) {
  const form = page.locator('text=My Stats').locator('..');

  if (stats.completion !== undefined) {
    const input = getInputByLabel(form, 'Completion');
    await input.fill(stats.completion.toString());
    await input.blur();
    await page.waitForTimeout(500); // Wait for auto-save
  }

  if (stats.difficulty !== undefined) {
    const select = getSelectByLabel(form, 'Skill Level');
    await select.selectOption(stats.difficulty);
    await page.waitForTimeout(500); // Wait for auto-save
  }

  if (stats.score !== undefined) {
    const input = getInputByLabel(form, 'Score');
    await input.fill(stats.score.toString());
    await input.blur();
    await page.waitForTimeout(500); // Wait for auto-save
  }

  if (stats.stars !== undefined) {
    const starButtons = form.locator('text=Stars').locator('..').locator('button[type="button"]');
    await starButtons.nth(stats.stars - 1).click();
    await page.waitForTimeout(500); // Wait for auto-save

    if (stats.gold && stats.stars === 5) {
      await form.getByLabel('Gold').check();
      await page.waitForTimeout(500); // Wait for auto-save
    }
  }

  if (stats.longestStreak !== undefined) {
    const input = getInputByLabel(form, 'Longest Streak');
    await input.fill(stats.longestStreak.toString());
    await input.blur();
    await page.waitForTimeout(500);
  }

  if (stats.notesHit !== undefined) {
    const input = getInputByLabel(form, 'Notes Hit');
    await input.fill(stats.notesHit.toString());
    await input.blur();
    await page.waitForTimeout(500);
  }

  if (stats.notesMissed !== undefined) {
    const input = getInputByLabel(form, 'Notes Missed');
    await input.fill(stats.notesMissed.toString());
    await input.blur();
    await page.waitForTimeout(500);
  }

  if (stats.avgMultiplier !== undefined) {
    const input = getInputByLabel(form, 'Avg. Multiplier');
    await input.fill(stats.avgMultiplier.toString());
    await input.blur();
    await page.waitForTimeout(500);
  }
}

export async function advanceToNextSong(page: Page) {
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=My Stats');
}

export async function finishPlaythrough(page: Page) {
  await page.click('button:has-text("Finish")');
  // Wait for summary page
  await page.waitForSelector('text=Playthrough Summary');
}
