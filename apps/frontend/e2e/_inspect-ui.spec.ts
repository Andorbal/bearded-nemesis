import { test } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Temporary test for inspecting the UI
 * Run with: pnpm test:e2e:headed _inspect-ui
 */

test('inspect start playthrough page', async ({ page }) => {
  // Login first
  await login(page);

  // Navigate to start playthrough page
  await page.goto('/playthroughs/start');

  // Pause to inspect the UI
  await page.pause();
});
