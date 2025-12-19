import { Page, expect } from '@playwright/test';

/**
 * Create a test setlist programmatically.
 * Navigates to setlist creation, fills in form, adds songs, and saves.
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 * @param options.name - Setlist name (default: "Test Setlist {timestamp}")
 * @param options.songCount - Number of songs to add (default: 3)
 * @returns Setlist information (name, and id if available)
 */
export async function createTestSetlist(
  page: Page,
  options: {
    name?: string;
    songCount?: number;
  } = {}
): Promise<{ name: string; id?: string }> {
  const setlistName = options.name || `Test Setlist ${Date.now()}`;
  const songCount = options.songCount || 3;

  // Navigate to setlist creation
  await page.goto('/setlists');
  await page.waitForLoadState('networkidle');

  // Click "+ Manual Setlist" button and wait for navigation
  const createButton = page.locator('button:has-text("+ Manual Setlist")');
  await expect(createButton).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/setlists\/new/),
    createButton.click()
  ]);

  // Fill in name (using id selector)
  await page.fill('#name', setlistName);

  // Click "Create Setlist" button and wait for navigation
  const saveButton = page.locator('button:has-text("Create Setlist")');
  await Promise.all([
    page.waitForURL(/\/setlists\/\d+/, { timeout: 10000 }),
    saveButton.click()
  ]);

  // Add songs to the setlist on the detail page
  if (songCount > 0) {
    await addSongsToSetlist(page, songCount);
  }

  return { name: setlistName };
}

/**
 * Add songs to a setlist by searching and clicking add buttons.
 * Assumes we're on the setlist detail page.
 *
 * @param page - Playwright page object
 * @param songCount - Number of songs to add
 */
export async function addSongsToSetlist(page: Page, songCount: number = 3): Promise<void> {
  const searchInput = page.locator('input[placeholder*="earch"]').first();

  // Add each song one at a time, re-searching each time to ensure results are visible
  for (let i = 0; i < songCount; i++) {
    // Search for songs (use a common term that will return many results)
    await searchInput.fill('the'); // Common word likely to return many songs

    // Click the Search button
    const searchButton = page.locator('button:has-text("Search")');
    await searchButton.click();

    // Wait for search results to appear
    await page.waitForTimeout(1500); // Wait for API call and rendering

    // Verify we have at least one "+ Add" button visible
    const addButton = page.locator('button:has-text("+ Add")').first();
    await expect(addButton).toBeVisible({ timeout: 5000 });

    // Click the first "+ Add" button
    await addButton.click();

    // Wait for toast/success message and UI update
    await page.waitForTimeout(800);
  }

  // Clear the search to show the final setlist
  await searchInput.fill('');
}

/**
 * Verify that a setlist exists in the setlist list.
 * Assumes we're on the /setlists page.
 *
 * @param page - Playwright page object
 * @param setlistName - Name of the setlist to verify
 * @returns true if setlist exists, false otherwise
 */
export async function verifySetlistExists(page: Page, setlistName: string): Promise<boolean> {
  const setlistLink = page.locator(`a:has-text("${setlistName}"), [data-testid="setlist-item"]:has-text("${setlistName}")`).first();

  try {
    await setlistLink.waitForSelector({ state: 'visible', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
