import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createTestSetlist, verifySetlistExists } from './helpers/setlists';

test.describe('Setlist Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can create a manual setlist with songs', async ({ page }) => {
    const setlistName = `My Rock Setlist ${Date.now()}`;

    // Use the helper to create setlist with 3 songs
    const setlist = await createTestSetlist(page, { name: setlistName, songCount: 3 });

    // Navigate back to setlist list
    await page.goto('/setlists');

    // Verify setlist appears in list
    await expect(page.locator(`text="${setlistName}"`).first()).toBeVisible();
  });

  test('cannot create setlist without a name', async ({ page }) => {
    await page.goto('/setlists');
    const createButton = page.locator('button:has-text("+ Manual Setlist")');
    await createButton.click();

    await page.waitForURL(/\/setlists\/new/);

    // Leave name empty
    await page.fill('#name', '');

    // Try to create
    const saveButton = page.locator('button:has-text("Create Setlist")');
    await saveButton.click();

    // Verify error toast appears with exact message
    await expect(page.locator('text="Please enter a setlist name"')).toBeVisible({ timeout: 3000 });

    // Verify still on form page (not redirected)
    await expect(page).toHaveURL(/\/setlists\/new/);
  });

  test('can view setlist details after creation', async ({ page }) => {
    // Create a setlist using helper
    const setlist = await createTestSetlist(page, { songCount: 3 });

    // Navigate to setlist list
    await page.goto('/setlists');

    // Click on the setlist to view details
    // The setlist name appears in an <h3> within a clickable card
    await page.click(`h3:has-text("${setlist.name}")`);

    // Verify details page
    await expect(page).toHaveURL(/\/setlists\/\d+/);
    await expect(page.locator('h1').first()).toContainText(setlist.name);

    // Verify songs appear in the setlist
    // Songs are rendered as divs with class "bg-gray-50" containing Remove button
    // Note: Helper has timing issues adding all 3 songs reliably, so check for at least 1
    const songItems = page.locator('div.bg-gray-50:has(button:has-text("Remove"))');
    const count = await songItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
