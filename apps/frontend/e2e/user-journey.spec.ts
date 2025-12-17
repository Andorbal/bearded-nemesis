import { test, expect } from '@playwright/test';

test.describe('Complete User Journey', () => {
  test('login → create setlist → start playthrough', async ({ page }) => {
    // Step 1: Login via UI
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in login form using ID selectors (match the auth helper)
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'test123');

    // Submit login and wait for redirect
    await Promise.all([
      page.waitForURL('/'),
      page.click('button[type="submit"]'),
    ]);

    // Verify logged in (user name or logout button visible)
    // Try multiple possible indicators of being logged in
    const loggedInIndicator = page.locator('button:has-text("Logout")').or(page.locator('a:has-text("Logout")')).or(page.locator('text=Test User'));
    await expect(loggedInIndicator.first()).toBeVisible();

    // Step 2: Navigate to Setlists using nav menu
    await page.click('a:has-text("Setlists")');
    await expect(page).toHaveURL('/setlists');
    await expect(page.locator('h1, h2')).toContainText(/Setlists/i);

    // Step 3: Click "+ Manual Setlist"
    const createButton = page.locator('button:has-text("+ Manual Setlist")');
    await createButton.click();

    // Wait for form
    await page.waitForURL(/\/setlists\/new/);

    // Step 4: Fill in setlist name
    const setlistName = `E2E Journey ${Date.now()}`;
    await page.fill('#name', setlistName);

    // Step 5: Click "Create Setlist"
    const saveButton = page.locator('button:has-text("Create Setlist")');
    await saveButton.click();

    // Step 6: Wait for redirect to setlist detail page
    await page.waitForURL(/\/setlists\/\d+/);

    // Step 7: Add 3 songs via search (re-search each time)
    const searchInput = page.locator('input[placeholder*="earch"]').first();

    for (let i = 0; i < 3; i++) {
      // Search each time
      await searchInput.fill('the');
      const searchButton = page.locator('button:has-text("Search")');
      await searchButton.click();

      // Wait for results
      await page.waitForTimeout(1500);

      // Click first "+ Add" button
      const addButton = page.locator('button:has-text("+ Add")').first();
      await addButton.click();
      await page.waitForTimeout(800);
    }

    // Clear search
    await searchInput.fill('');

    // Step 8: Navigate back to setlists and verify it appears
    await page.goto('/setlists');
    await expect(page.locator(`text="${setlistName}"`).first()).toBeVisible();

    // Step 9: Navigate to Playthroughs using nav menu
    await page.click('a:has-text("Playthroughs")');
    await expect(page).toHaveURL('/playthroughs');

    // Step 10: Click "+ New Playthrough" button
    await page.click('button:has-text("+ New Playthrough")');
    await page.waitForURL(/\/playthroughs\/(start|new)/);

    // Step 11: Select the setlist we just created from dropdown
    // Note: Using nth(0) for setlist dropdown (based on notes about select ordering)
    const setlistSelect = page.locator('select').nth(0);
    await setlistSelect.selectOption({ label: setlistName });

    // Step 12: Select instrument: drums, difficulty: expert
    // Player 1 (default) - using nth(1) and nth(2) for instrument and difficulty
    const instrumentSelect = page.locator('select').nth(1);
    await instrumentSelect.selectOption('drums');

    const difficultySelect = page.locator('select').nth(2);
    await difficultySelect.selectOption('expert');

    // Step 13: Click "Start Playthrough"
    await page.click('button:has-text("Start Playthrough")');

    // Step 14: Verify first song loads
    // Wait for active playthrough page
    await page.waitForURL(/\/playthroughs\/\d+/, { timeout: 10000 });

    // Verify song title is visible
    const songTitle = page.locator('h1, h2, [data-testid="song-title"]').first();
    await expect(songTitle).toBeVisible();

    // Verify "Rate This Song" or rating UI is visible
    await expect(
      page.locator('text=/Rate.*Song/i').or(page.locator('text=My Rating')).or(page.locator('text=Rating'))
    ).toBeVisible();

    // Verify "Connected" status or player status
    await expect(
      page.locator('text=/Connected/i').or(page.locator('[data-testid="player-status"]'))
    ).toBeVisible();
  });
});
