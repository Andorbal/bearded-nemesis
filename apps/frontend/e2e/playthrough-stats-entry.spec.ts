import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { startPlaythrough, rateSong, enterStats, advanceToNextSong, finishPlaythrough } from './helpers/playthrough';

/**
 * E2E Specs: Manual Stats Entry During Active Playthrough
 *
 * Based on specs.md Gherkin scenarios
 */

test.describe('Manual Stats Entry Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await login(page);

    // TODO: Set up test data (create setlist with 3+ songs)
    // This might need to be done via API or database seeding
  });

  test('Scenario 1: Entering stats for the first song', async ({ page }) => {
    // Given I am logged in and have started a playthrough
    await startPlaythrough(page, 'Test Setlist', 'expert');

    // And I have rated the song 4 stars
    await rateSong(page, 4);

    // When I scroll to the "My Stats" form
    const statsForm = page.locator('text=My Stats').locator('..');
    await statsForm.scrollIntoViewIfNeeded();

    // Then I should see 8 input fields in correct order
    await expect(statsForm.getByLabel('Completion')).toBeVisible();
    await expect(statsForm.getByLabel('Skill Level')).toBeVisible();
    await expect(statsForm.getByLabel('Score')).toBeVisible();
    await expect(statsForm.locator('text=Stars')).toBeVisible();
    await expect(statsForm.getByLabel('Longest Streak')).toBeVisible();
    await expect(statsForm.getByLabel('Notes Hit')).toBeVisible();
    await expect(statsForm.getByLabel('Notes Missed')).toBeVisible();
    await expect(statsForm.getByLabel('Avg. Multiplier')).toBeVisible();

    // And the "Skill Level" dropdown should default to "expert"
    await expect(statsForm.getByLabel('Skill Level')).toHaveValue('expert');

    // And all other fields should be empty
    await expect(statsForm.getByLabel('Completion')).toHaveValue('');
    await expect(statsForm.getByLabel('Score')).toHaveValue('');
  });

  test('Scenario 2: Auto-save behavior', async ({ page }) => {
    // Given I am on the "My Stats" form
    await startPlaythrough(page, 'Test Setlist', 'expert');
    const statsForm = page.locator('text=My Stats').locator('..');

    // When I enter "95.5" in the "Completion" field
    await statsForm.getByLabel('Completion').fill('95.5');

    // And I move focus to the next field (tab or tap)
    await statsForm.getByLabel('Completion').blur();

    // Wait for auto-save (check network request)
    await page.waitForResponse(response =>
      response.url().includes('/stats') && response.status() === 200
    );

    // Then the completion percentage should be saved immediately
    // Refresh the page to verify persistence
    await page.reload();
    await expect(statsForm.getByLabel('Completion')).toHaveValue('95.5');

    // And I should see no error messages
    await expect(page.locator('text=Failed to save')).not.toBeVisible();

    // When I enter "150000" in the "Score" field
    await statsForm.getByLabel('Score').fill('150000');

    // And I tap outside the field
    await statsForm.getByLabel('Longest Streak').click();

    // Then the score should be saved immediately
    await page.waitForResponse(response =>
      response.url().includes('/stats') && response.status() === 200
    );

    // And I should see no error messages
    await expect(page.locator('text=Failed to save')).not.toBeVisible();
  });

  test('Scenario 3: Star rating with gold stars', async ({ page }) => {
    // Given I am on the "My Stats" form
    await startPlaythrough(page, 'Test Setlist', 'expert');
    const statsForm = page.locator('text=My Stats').locator('..');
    const starSection = statsForm.locator('text=Stars').locator('..');

    // And the "Stars" field shows 0 stars (all empty)
    const stars = starSection.locator('button[type="button"]');
    const emptyStars = await stars.locator('text=☆').count();
    expect(emptyStars).toBe(5);

    // When I tap the 5th star
    await stars.nth(4).click();

    // Then all 5 stars should be filled in yellow
    const filledStars = await stars.locator('text=★').count();
    expect(filledStars).toBe(5);

    // And a "Gold" toggle should appear next to the stars
    await expect(starSection.getByLabel('Gold')).toBeVisible();

    // And the value saved should be 5
    await page.waitForResponse(response =>
      response.url().includes('/stats') &&
      response.status() === 200
    );

    // When I enable the "Gold" toggle
    await starSection.getByLabel('Gold').check();

    // Then all 5 stars should turn gold (darker yellow)
    // Check for gold color class
    const goldStar = stars.first().locator('text=★');
    await expect(goldStar).toHaveClass(/text-yellow-400/);

    // And the value saved should be 6
    await page.waitForResponse(response =>
      response.url().includes('/stats') &&
      response.status() === 200
    );

    // When I tap the 3rd star
    await stars.nth(2).click();

    // Then only 3 stars should be filled
    const filledStarsAfter = await stars.locator('text=★').count();
    expect(filledStarsAfter).toBe(3);

    // And the "Gold" toggle should disappear
    await expect(starSection.getByLabel('Gold')).not.toBeVisible();

    // And the value saved should be 3
    await page.waitForResponse(response =>
      response.url().includes('/stats') &&
      response.status() === 200
    );
  });

  test('Scenario 4: Field navigation with Enter key', async ({ page }) => {
    // Given I am on the "My Stats" form
    await startPlaythrough(page, 'Test Setlist', 'expert');
    const statsForm = page.locator('text=My Stats').locator('..');

    // And I am focused on the "Completion" field
    await statsForm.getByLabel('Completion').focus();

    // When I type "95" and press Enter
    await statsForm.getByLabel('Completion').fill('95');
    await statsForm.getByLabel('Completion').press('Enter');

    // Then the value should be saved
    await page.waitForResponse(response =>
      response.url().includes('/stats') && response.status() === 200
    );

    // And focus should move to the "Skill Level" dropdown
    await expect(statsForm.getByLabel('Skill Level')).toBeFocused();

    // When I select "hard" and press Tab
    await statsForm.getByLabel('Skill Level').selectOption('hard');
    await statsForm.getByLabel('Skill Level').press('Tab');

    // Then the value should be saved
    await page.waitForResponse(response =>
      response.url().includes('/stats') && response.status() === 200
    );

    // And focus should move to the "Score" field
    await expect(statsForm.getByLabel('Score')).toBeFocused();

    // When I type "120000" and press Enter
    await statsForm.getByLabel('Score').fill('120000');
    await statsForm.getByLabel('Score').press('Enter');

    // Then the value should be saved
    await page.waitForResponse(response =>
      response.url().includes('/stats') && response.status() === 200
    );

    // And focus should move to the "Stars" field (first star button)
    // Note: Implementation may vary based on how star field handles focus
  });

  test('Scenario 6: Difficulty defaults to previous song', async ({ page }) => {
    // Given I completed the first song with "expert" difficulty
    await startPlaythrough(page, 'Test Setlist', 'expert');
    const statsForm = page.locator('text=My Stats').locator('..');

    // Verify difficulty is "expert"
    await expect(statsForm.getByLabel('Skill Level')).toHaveValue('expert');

    // And I entered stats for the first song
    await enterStats(page, {
      completion: 95,
      score: 150000,
      stars: 5
    });

    // When I advance to the second song
    await advanceToNextSong(page);

    // And I view the "My Stats" form
    const statsFormSong2 = page.locator('text=My Stats').locator('..');

    // Then the "Skill Level" should default to "expert"
    await expect(statsFormSong2.getByLabel('Skill Level')).toHaveValue('expert');

    // When I change the skill level to "hard"
    await statsFormSong2.getByLabel('Skill Level').selectOption('hard');
    await page.waitForResponse(response =>
      response.url().includes('/stats') && response.status() === 200
    );

    // And I save the stats
    await enterStats(page, {
      completion: 90,
      score: 140000,
      stars: 4
    });

    // And I advance to the third song
    await advanceToNextSong(page);

    // Then the "Skill Level" should default to "hard"
    const statsFormSong3 = page.locator('text=My Stats').locator('..');
    await expect(statsFormSong3.getByLabel('Skill Level')).toHaveValue('hard');
  });

  test('Scenario 7: Pre-filled stats (editing existing stats)', async ({ page }) => {
    // Given I previously entered stats for the current song
    await startPlaythrough(page, 'Test Setlist', 'expert');

    // Enter stats
    await enterStats(page, {
      completion: 95.5,
      difficulty: 'expert',
      score: 150000,
      stars: 5,
      gold: true,
      longestStreak: 145,
      notesHit: 523,
      notesMissed: 12,
      avgMultiplier: 3.9
    });

    // Refresh the page to simulate returning to the song
    await page.reload();

    // When I view the "My Stats" form
    const statsForm = page.locator('text=My Stats').locator('..');

    // Then all fields should be pre-filled with the saved values
    await expect(statsForm.getByLabel('Completion')).toHaveValue('95.5');
    await expect(statsForm.getByLabel('Skill Level')).toHaveValue('expert');
    await expect(statsForm.getByLabel('Score')).toHaveValue('150000');
    await expect(statsForm.getByLabel('Longest Streak')).toHaveValue('145');
    await expect(statsForm.getByLabel('Notes Hit')).toHaveValue('523');
    await expect(statsForm.getByLabel('Notes Missed')).toHaveValue('12');
    await expect(statsForm.getByLabel('Avg. Multiplier')).toHaveValue('3.9');

    // And the star selector should show 5 gold stars
    const starSection = statsForm.locator('text=Stars').locator('..');
    const filledStars = await starSection.locator('button').locator('text=★').count();
    expect(filledStars).toBe(5);

    // And the "Gold" toggle should be enabled
    await expect(starSection.getByLabel('Gold')).toBeChecked();
  });

  test('Scenario 10: Screenshot upload still works (no OCR)', async ({ page }) => {
    // Given I am on an active playthrough song
    await startPlaythrough(page, 'Test Setlist', 'expert');

    // And I have entered my stats
    await enterStats(page, {
      completion: 95,
      score: 150000,
      stars: 5
    });

    // When I tap "Take/Upload Screenshot"
    // Note: File upload testing requires special handling in Playwright
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-screenshot.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data')
    });

    // Then I should see "Screenshot uploaded" confirmation
    await expect(page.locator('text=Screenshot uploaded')).toBeVisible();

    // And I should NOT see any OCR processing indicators
    await expect(page.locator('text=Processing')).not.toBeVisible();
    await expect(page.locator('text=OCR')).not.toBeVisible();

    // And I should NOT see OCR status (pending/completed/failed)
    await expect(page.locator('text=pending')).not.toBeVisible();
    await expect(page.locator('text=completed')).not.toBeVisible();
    await expect(page.locator('text=failed')).not.toBeVisible();

    // And the screenshot should be saved for future viewing
    // (This would require checking the playthrough summary later)
  });

  test('Scenario 11: Viewing saved stats in playthrough summary', async ({ page }) => {
    // Given I have completed a playthrough
    await startPlaythrough(page, 'Test Setlist', 'expert');

    // Song 1 - Expert
    await enterStats(page, {
      completion: 95.5,
      difficulty: 'expert',
      score: 150000,
      stars: 5,
      gold: true,
      longestStreak: 145,
      notesHit: 523,
      notesMissed: 12,
      avgMultiplier: 3.9
    });
    await advanceToNextSong(page);

    // Song 2 - Hard
    await enterStats(page, {
      completion: 90,
      difficulty: 'hard',
      score: 120000,
      stars: 4,
      longestStreak: 120,
      notesHit: 450,
      notesMissed: 25,
      avgMultiplier: 3.5
    });
    await advanceToNextSong(page);

    // Song 3 - Expert
    await enterStats(page, {
      completion: 98,
      difficulty: 'expert',
      score: 180000,
      stars: 5,
      longestStreak: 200,
      notesHit: 600,
      notesMissed: 5,
      avgMultiplier: 4.0
    });

    // Finish playthrough
    await finishPlaythrough(page);

    // When I view the playthrough summary
    const summary = page.locator('text=Playthrough Summary').locator('..');

    // Then for each song I should see the stats
    // Song 1
    await expect(summary.locator('text=expert').first()).toBeVisible();
    await expect(summary.locator('text=150000').first()).toBeVisible();
    await expect(summary.locator('text=95.5').first()).toBeVisible();

    // And I should NOT see any OCR-related information
    await expect(summary.locator('text=OCR')).not.toBeVisible();
    await expect(summary.locator('text=Re-run')).not.toBeVisible();
  });
});

test.describe('Mobile-Specific Behavior', () => {
  // Inherits mobile project config (iPhone 17 Pro: 430x932)

  test('Scenario 5: Mobile numeric keyboard behavior', async ({ page }) => {
    // Given I am on a mobile device
    await login(page);
    await startPlaythrough(page, 'Test Setlist', 'expert');

    const statsForm = page.locator('text=My Stats').locator('..');

    // When I tap the "Completion" field
    const completionField = statsForm.getByLabel('Completion');
    await completionField.click();

    // Then the mobile numeric keyboard should appear
    // And the keyboard should show decimal point option
    await expect(completionField).toHaveAttribute('inputmode', 'decimal');

    // When I tap the "Score" field
    const scoreField = statsForm.getByLabel('Score');
    await scoreField.click();

    // Then the mobile numeric keyboard should appear
    // And the keyboard should show only digits (no decimal)
    await expect(scoreField).toHaveAttribute('inputmode', 'numeric');

    // When I tap the "Avg. Multiplier" field
    const multiplierField = statsForm.getByLabel('Avg. Multiplier');
    await multiplierField.click();

    // Then the mobile numeric keyboard should appear
    // And the keyboard should show decimal point option
    await expect(multiplierField).toHaveAttribute('inputmode', 'decimal');
  });

  test('Mobile tap targets are accessible', async ({ page }) => {
    // Given I am on a mobile device
    await login(page);
    await startPlaythrough(page, 'Test Setlist', 'expert');

    const statsForm = page.locator('text=My Stats').locator('..');

    // Verify all inputs have minimum 44px height (iOS guideline)
    const completionField = statsForm.getByLabel('Completion');
    const box = await completionField.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // Verify star buttons are tappable
    const starSection = statsForm.locator('text=Stars').locator('..');
    const starButtons = starSection.locator('button[type="button"]');
    const starBox = await starButtons.first().boundingBox();
    expect(starBox?.height).toBeGreaterThanOrEqual(44);
  });
});
