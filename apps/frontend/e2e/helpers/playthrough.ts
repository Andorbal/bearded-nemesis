import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helpers - Playthrough Operations
 */

export async function startPlaythrough(
  page: Page,
  setlistName: string,
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'expert'
) {
  // Navigate to setlists
  await page.goto('/setlists');

  // Find and click the setlist
  await page.click(`text=${setlistName}`);

  // Click "Start Playthrough" button
  await page.click('button:has-text("Start Playthrough")');

  // Select difficulty
  await page.selectOption('select[name="difficulty"]', difficulty);

  // Confirm
  await page.click('button:has-text("Confirm")');

  // Wait for playthrough page to load
  await page.waitForSelector('text=My Stats');
}

export async function rateSong(page: Page, rating: number) {
  // Assuming rating is in a "My Rating" section
  const ratingSection = page.locator('text=My Rating').locator('..');
  const stars = ratingSection.locator('button[type="button"]');

  // Click the nth star (1-indexed)
  await stars.nth(rating - 1).click();
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
    await form.getByLabel('Completion').fill(stats.completion.toString());
    await form.getByLabel('Completion').blur();
    await page.waitForTimeout(500); // Wait for auto-save
  }

  if (stats.difficulty !== undefined) {
    await form.getByLabel('Skill Level').selectOption(stats.difficulty);
    await page.waitForTimeout(500); // Wait for auto-save
  }

  if (stats.score !== undefined) {
    await form.getByLabel('Score').fill(stats.score.toString());
    await form.getByLabel('Score').blur();
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
    await form.getByLabel('Longest Streak').fill(stats.longestStreak.toString());
    await form.getByLabel('Longest Streak').blur();
    await page.waitForTimeout(500);
  }

  if (stats.notesHit !== undefined) {
    await form.getByLabel('Notes Hit').fill(stats.notesHit.toString());
    await form.getByLabel('Notes Hit').blur();
    await page.waitForTimeout(500);
  }

  if (stats.notesMissed !== undefined) {
    await form.getByLabel('Notes Missed').fill(stats.notesMissed.toString());
    await form.getByLabel('Notes Missed').blur();
    await page.waitForTimeout(500);
  }

  if (stats.avgMultiplier !== undefined) {
    await form.getByLabel('Avg. Multiplier').fill(stats.avgMultiplier.toString());
    await form.getByLabel('Avg. Multiplier').blur();
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
