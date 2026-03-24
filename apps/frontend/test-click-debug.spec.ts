import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test('Debug: Check if button click triggers navigation', async ({ page }) => {
  await login(page);
  
  // Navigate to setlists
  await page.goto('/setlists');
  await page.waitForLoadState('networkidle');
  
  // Log the current URL
  console.log('Current URL before click:', page.url());
  
  // Find the button
  const createButton = page.locator('button:has-text("+ Manual Setlist")');
  await expect(createButton).toBeVisible();
  
  // Try clicking with Promise.all to wait for navigation
  await Promise.all([
    page.waitForURL(/\/setlists\/new/, { timeout: 10000 }),
    createButton.click()
  ]);
  
  console.log('Current URL after click:', page.url());
  
  // Verify we navigated
  await expect(page).toHaveURL(/\/setlists\/new/);
});
