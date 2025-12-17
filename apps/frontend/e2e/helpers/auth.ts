import { Page } from '@playwright/test';

/**
 * E2E Test Helpers - Authentication
 */

export async function login(page: Page, username = 'testuser', password = 'test123') {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('#username', username);
  await page.fill('#password', password);

  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL('/'),
    page.click('button[type="submit"]'),
  ]);
}

export async function logout(page: Page) {
  // Assuming there's a logout button in the UI
  await page.click('button:has-text("Logout")');
  await page.waitForURL('/login');
}
