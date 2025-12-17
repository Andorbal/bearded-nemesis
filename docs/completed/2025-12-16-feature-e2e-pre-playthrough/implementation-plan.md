---
title: E2E Tests for Login, Setlist Creation, and Playthrough Start Flow - Implementation Plan
type: feature
status: active
created_date: 2025-12-15
gitlab_issue: null
gitlab_mr: null
---

# Implementation Plan: E2E Pre-Playthrough Tests

## Overview

This plan breaks down the implementation of comprehensive E2E tests for the login → setlist creation → playthrough start flow into manageable phases with specific tasks.

See `design.md` for complete design details and rationale.

## Current Progress (2025-12-16)

**Test Results: 8 of 14 passing (57%)**

✅ **Passing Tests:**
- Can create manual setlist with songs (chromium + mobile)
- Can start playthrough with single player (chromium + mobile)
- Cannot create setlist without name - validation (chromium + mobile)
- Cannot start playthrough without setlist - validation (chromium + mobile)

❌ **Failing Tests:**
- Can start playthrough with two players (chromium + mobile) - **Known 2-player API 400 bug**
- Can view setlist details after creation (chromium + mobile) - Navigation issue
- Complete user journey test (chromium + mobile) - Navigation issue

**Key Fixes Applied:**
- ✅ Fixed SSR `document is not defined` error with browser guards
- ✅ Corrected all button/link text selectors to match actual UI
- ✅ Fixed setlist creation flow (create first, then add songs via search)
- ✅ Fixed song-adding flow (re-search before each add to maintain UI state)
- ✅ Fixed Playwright selectOption timing issues with waits

## Prerequisites

- [x] Playwright configured (from paused branch `feature/playthrough-streamline-e2e-setup`)
- [x] Database seeder `seed-e2e.ts` working
- [x] `e2e/helpers/auth.ts` working
- [x] PostgreSQL running in Docker
- [x] API server can run locally

## Phase 0: Write Executable Specifications (Decision pending)

⚠️ **REMINDER:** Before starting implementation, decide whether to write executable specifications.

- [ ] Decide: Write specs or skip?
- [ ] If yes: Write Playwright BDD specs for the test scenarios
- [ ] If no: Document decision in notes.md

**Recommendation for this work:** Skip specs - these ARE the executable specifications (E2E tests). The tests themselves verify the acceptance criteria.

## Phase 1: Update Existing Helpers

### Task 1.1: Fix playthroughs.ts helper to match actual UI
**File:** `apps/frontend/e2e/helpers/playthroughs.ts`

**Current problem:** Helper assumes simple difficulty selector, but actual UI has:
- Setlist dropdown
- Per-player instrument selection
- Per-player difficulty selection
- "+ Add Player" button

**Changes needed:**
```typescript
async function startPlaythrough(
  page: Page,
  setlistName: string,
  players: Array<{ instrument: string; difficulty: string }> = [
    { instrument: 'drums', difficulty: 'expert' }
  ]
) {
  // 1. Select setlist from dropdown
  await page.selectOption('[data-testid="setlist-select"]', setlistName);
  // OR: await page.selectOption('select[name="setlist"]', setlistName);

  // 2. For first player (should be present by default)
  await page.selectOption('[data-testid="player-0-instrument"]', players[0].instrument);
  await page.selectOption('[data-testid="player-0-difficulty"]', players[0].difficulty);

  // 3. For additional players
  for (let i = 1; i < players.length; i++) {
    await page.click('button:has-text("+ Add Player")');
    await page.selectOption(`[data-testid="player-${i}-instrument"]`, players[i].instrument);
    await page.selectOption(`[data-testid="player-${i}-difficulty"]`, players[i].difficulty);
  }

  // 4. Click "Start Playthrough"
  await page.click('button:has-text("Start Playthrough")');

  // 5. Wait for active playthrough page
  await page.waitForURL(/\/playthroughs\/\d+/);
}
```

**Note:** Actual selectors will need to be discovered by inspecting the UI. Use Playwright's `--headed` mode to see what's available.

**Verification:**
- [ ] Helper works with 1 player
- [ ] Helper works with 2 players
- [ ] Helper correctly selects setlist, instruments, and difficulties

### Task 1.2: Add verifyPlaythroughStarted helper
**File:** `apps/frontend/e2e/helpers/playthroughs.ts`

```typescript
async function verifyPlaythroughStarted(page: Page, options: {
  expectedSongTitle?: string;
  expectedPlayerCount?: number;
}) {
  // Check URL is active playthrough
  await expect(page).toHaveURL(/\/playthroughs\/\d+/);

  // Check first song title is visible
  if (options.expectedSongTitle) {
    await expect(page.locator('h2, [data-testid="song-title"]')).toContainText(options.expectedSongTitle);
  }

  // Check My Stats form exists (if building toward stats entry)
  await expect(page.locator('text=My Stats, text=My Rating')).toBeVisible();

  // Check player info is displayed
  if (options.expectedPlayerCount) {
    const players = page.locator('[data-testid="player-info"]');
    await expect(players).toHaveCount(options.expectedPlayerCount);
  }
}
```

**Verification:**
- [ ] Helper correctly verifies playthrough started
- [ ] Helper checks for expected song title
- [ ] Helper verifies player count if provided

## Phase 2: Create Setlist Helpers (NEW)

### Task 2.1: Create setlists.ts helper file
**File:** `apps/frontend/e2e/helpers/setlists.ts`

**Structure:**
```typescript
import { Page, expect } from '@playwright/test';

export async function createTestSetlist(
  page: Page,
  options: {
    name?: string;
    songCount?: number;
  } = {}
): Promise<{ name: string; id?: string }> {
  // Implementation in Task 2.2
}

export async function addSongsToSetlist(page: Page, songCount: number = 3): Promise<void> {
  // Implementation in Task 2.3
}

export async function verifySetlistExists(page: Page, setlistName: string): Promise<boolean> {
  // Implementation in Task 2.4
}
```

### Task 2.2: Implement createTestSetlist function

**Logic:**
```typescript
const setlistName = options.name || `Test Setlist ${Date.now()}`;
const songCount = options.songCount || 3;

// Navigate to setlist creation
await page.goto('/setlists');
await page.click('button:has-text("Create New Setlist"), a:has-text("New Setlist")');

// Fill in form
await page.fill('[data-testid="setlist-name"], input[name="name"]', setlistName);
await page.selectOption('[data-testid="setlist-type"], select[name="type"]', 'manual');

// Add songs
await addSongsToSetlist(page, songCount);

// Save
await page.click('button:has-text("Save"), button:has-text("Create")');

// Wait for redirect to setlist list
await page.waitForURL('/setlists');

// Verify creation
await expect(page.locator(`text=${setlistName}`)).toBeVisible();

return { name: setlistName };
```

**Verification:**
- [ ] Creates setlist with unique name
- [ ] Adds specified number of songs
- [ ] Returns setlist info for use in tests

### Task 2.3: Implement addSongsToSetlist function

**Logic:**
```typescript
// Find available songs list
const songList = page.locator('[data-testid="available-songs"], .song-list');

// Click "Add" button for first N songs
for (let i = 0; i < songCount; i++) {
  const addButton = songList.locator('button:has-text("Add")').nth(i);
  await addButton.click();

  // Wait for song to be added to setlist
  await page.waitForTimeout(300); // Brief wait for UI update
}

// Alternative: If there's a song selector/checkbox
// await page.locator('[data-testid="song-checkbox"]').nth(i).check();
```

**Note:** Actual implementation depends on UI. May need to:
- Search for songs first
- Click checkboxes instead of buttons
- Drag and drop songs

**Verification:**
- [ ] Adds correct number of songs
- [ ] Songs appear in setlist preview

### Task 2.4: Implement verifySetlistExists function

**Logic:**
```typescript
const setlistLink = page.locator(`a:has-text("${setlistName}"), [data-testid="setlist-item"]:has-text("${setlistName}")`);
const exists = await setlistLink.isVisible();
return exists;
```

**Verification:**
- [ ] Returns true when setlist exists
- [ ] Returns false when setlist doesn't exist

## Phase 3: Write User Journey Test

### Task 3.1: Create user-journey.spec.ts
**File:** `apps/frontend/e2e/user-journey.spec.ts`

**Template:**
```typescript
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Complete User Journey', () => {
  test('login → create setlist → start playthrough', async ({ page }) => {
    // Step 1: Login via UI
    await page.goto('/');
    await page.click('button:has-text("Login"), a:has-text("Login")');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'test123');
    await Promise.all([
      page.waitForURL('/'),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.locator('text=Test User')).toBeVisible();

    // Step 2: Navigate to Setlists using nav
    await page.click('a:has-text("Setlists")');
    await expect(page).toHaveURL('/setlists');

    // Step 3-8: Create setlist (implement in subtasks)
    const setlistName = `E2E Journey ${Date.now()}`;
    // ... (Tasks 3.2-3.4)

    // Step 9: Navigate to Playthroughs
    await page.click('a:has-text("Playthroughs")');
    await expect(page).toHaveURL('/playthroughs');

    // Step 10-14: Start playthrough (Tasks 3.5-3.6)
    // ...
  });
});
```

### Task 3.2: Implement setlist creation in journey test

**Steps:**
```typescript
// Click "Create New Setlist"
await page.click('button:has-text("Create New Setlist"), a:has-text("New Setlist")');

// Fill in name
await page.fill('[data-testid="setlist-name"]', setlistName);

// Select type: Manual
await page.selectOption('[data-testid="setlist-type"]', 'manual');
```

### Task 3.3: Implement song addition in journey test

**Steps:**
```typescript
// Add 3 songs (click "Add" button for first 3 songs in list)
const songButtons = page.locator('[data-testid="available-songs"] button:has-text("Add")');
await songButtons.nth(0).click();
await songButtons.nth(1).click();
await songButtons.nth(2).click();
```

### Task 3.4: Verify setlist creation in journey test

**Steps:**
```typescript
// Save setlist
await page.click('button:has-text("Save"), button:has-text("Create")');

// Verify redirect to setlist list
await expect(page).toHaveURL('/setlists');

// Verify setlist appears in list
await expect(page.locator(`text=${setlistName}`)).toBeVisible();
```

### Task 3.5: Implement playthrough start in journey test

**Steps:**
```typescript
// Click "Start New Playthrough"
await page.click('button:has-text("Start New Playthrough"), a:has-text("Start Playthrough")');

// Select the setlist we just created
await page.selectOption('[data-testid="setlist-select"]', setlistName);

// Select instrument and difficulty for player 1
await page.selectOption('[data-testid="player-0-instrument"]', 'drums');
await page.selectOption('[data-testid="player-0-difficulty"]', 'expert');

// Click "Start Playthrough"
await page.click('button:has-text("Start Playthrough")');
```

### Task 3.6: Verify playthrough started in journey test

**Steps:**
```typescript
// Verify redirected to active playthrough
await expect(page).toHaveURL(/\/playthroughs\/\d+/);

// Verify first song loads
const firstSongTitle = await page.locator('h2, [data-testid="song-title"]').textContent();
expect(firstSongTitle).toBeTruthy();

// Verify rating UI exists
await expect(page.locator('text=My Rating')).toBeVisible();

// Verify My Stats form exists (foundation for stats entry tests)
await expect(page.locator('text=My Stats')).toBeVisible();
```

**Verification:**
- [ ] Complete journey test passes
- [ ] Test verifies navigation through UI (not direct URLs)
- [ ] Test creates setlist and starts playthrough successfully

## Phase 4: Write Setlist Tests

### Task 4.1: Create setlists.spec.ts with test structure
**File:** `apps/frontend/e2e/setlists.spec.ts`

**Structure:**
```typescript
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createTestSetlist, verifySetlistExists } from './helpers/setlists';

test.describe('Setlist Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can create a manual setlist with songs', async ({ page }) => {
    // Task 4.2
  });

  test('cannot create setlist without a name', async ({ page }) => {
    // Task 4.3
  });

  test('can view setlist details after creation', async ({ page }) => {
    // Task 4.4
  });
});
```

### Task 4.2: Implement happy path setlist creation test

**Logic:**
```typescript
await page.goto('/setlists');

const setlistName = `My Rock Setlist ${Date.now()}`;

// Click create button
await page.click('button:has-text("Create New Setlist")');

// Fill form
await page.fill('[data-testid="setlist-name"]', setlistName);
await page.selectOption('[data-testid="setlist-type"]', 'manual');

// Add 3 songs
const addButtons = page.locator('[data-testid="available-songs"] button:has-text("Add")');
await addButtons.nth(0).click();
await addButtons.nth(1).click();
await addButtons.nth(2).click();

// Save
await page.click('button:has-text("Save")');

// Verify
await expect(page).toHaveURL('/setlists');
await expect(page.locator(`text=${setlistName}`)).toBeVisible();
```

**Verification:**
- [ ] Test creates setlist successfully
- [ ] Setlist appears in list

### Task 4.3: Implement validation test (no name)

**Logic:**
```typescript
await page.goto('/setlists');
await page.click('button:has-text("Create New Setlist")');

// Leave name empty
await page.fill('[data-testid="setlist-name"]', '');

// Try to save
await page.click('button:has-text("Save")');

// Verify error message
await expect(page.locator('text=/name is required/i, text=/name.*cannot be empty/i')).toBeVisible();

// Verify still on form page
await expect(page).toHaveURL(/\/setlists\/new|\/setlists\/create/);
```

**Verification:**
- [ ] Shows error message
- [ ] Doesn't create setlist
- [ ] Stays on form page

### Task 4.4: Implement view setlist details test

**Logic:**
```typescript
// Create a setlist using helper
const setlist = await createTestSetlist(page, { songCount: 3 });

// Navigate to setlist details
await page.goto('/setlists');
await page.click(`a:has-text("${setlist.name}")`);

// Verify details page
await expect(page).toHaveURL(/\/setlists\/\d+/);
await expect(page.locator('h1, h2')).toContainText(setlist.name);

// Verify 3 songs appear
const songs = page.locator('[data-testid="setlist-song"], .song-item');
await expect(songs).toHaveCount(3);

// Verify type is Manual
await expect(page.locator('text=Manual, [data-testid="setlist-type"]:has-text("Manual")')).toBeVisible();
```

**Verification:**
- [ ] Can view created setlist
- [ ] Shows correct number of songs
- [ ] Shows correct setlist type

## Phase 5: Write Playthrough Tests

### Task 5.1: Create playthroughs.spec.ts with test structure
**File:** `apps/frontend/e2e/playthroughs.spec.ts`

**Structure:**
```typescript
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createTestSetlist } from './helpers/setlists';
import { startPlaythrough, verifyPlaythroughStarted } from './helpers/playthroughs';

test.describe('Playthrough Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can start playthrough with single player', async ({ page }) => {
    // Task 5.2
  });

  test('can start playthrough with two players', async ({ page }) => {
    // Task 5.3
  });

  test('cannot start playthrough without selecting setlist', async ({ page }) => {
    // Task 5.4
  });
});
```

### Task 5.2: Implement single player playthrough test

**Logic:**
```typescript
// Create test setlist using helper
const setlist = await createTestSetlist(page);

// Navigate directly to playthrough start
await page.goto('/playthroughs/start');

// Use helper to start playthrough
await startPlaythrough(page, setlist.name, [
  { instrument: 'guitar', difficulty: 'hard' }
]);

// Verify playthrough started
await verifyPlaythroughStarted(page, {
  expectedPlayerCount: 1
});
```

**Verification:**
- [ ] Single player playthrough starts successfully
- [ ] Player info is displayed correctly

### Task 5.3: Implement two player playthrough test

**Logic:**
```typescript
const setlist = await createTestSetlist(page);
await page.goto('/playthroughs/start');

// Start with 2 players
await startPlaythrough(page, setlist.name, [
  { instrument: 'drums', difficulty: 'expert' },
  { instrument: 'guitar', difficulty: 'hard' }
]);

// Verify both players appear
await verifyPlaythroughStarted(page, {
  expectedPlayerCount: 2
});

// Verify both instruments are shown
await expect(page.locator('text=drums, [data-testid="player-0-instrument"]:has-text("drums")')).toBeVisible();
await expect(page.locator('text=guitar, [data-testid="player-1-instrument"]:has-text("guitar")')).toBeVisible();
```

**Verification:**
- [ ] Two player playthrough starts successfully
- [ ] Both players displayed with correct instruments

### Task 5.4: Implement validation test (no setlist selected)

**Logic:**
```typescript
await page.goto('/playthroughs/start');

// Select instrument/difficulty but leave setlist empty
await page.selectOption('[data-testid="player-0-instrument"]', 'drums');
await page.selectOption('[data-testid="player-0-difficulty"]', 'expert');

// Try to start
const startButton = page.locator('button:has-text("Start Playthrough")');

// Check if button is disabled OR shows error when clicked
const isDisabled = await startButton.isDisabled();

if (!isDisabled) {
  await startButton.click();
  // Verify error message appears
  await expect(page.locator('text=/select.*setlist/i, text=/setlist.*required/i')).toBeVisible();
}

// Verify we're still on the start page
await expect(page).toHaveURL(/\/playthroughs\/start|\/playthroughs\/new/);
```

**Verification:**
- [ ] Cannot start without setlist
- [ ] Shows error or disables button
- [ ] Stays on start page

## Phase 6: Verification & Refinement

### Task 6.1: Run all tests and verify they pass

**Command:**
```bash
cd apps/frontend
pnpm test:e2e
```

**Verification:**
- [ ] All tests in `user-journey.spec.ts` pass
- [ ] All tests in `setlists.spec.ts` pass
- [ ] All tests in `playthroughs.spec.ts` pass
- [ ] Tests complete in <2 minutes total
- [ ] No flaky failures on re-run

### Task 6.2: Update selectors based on actual UI

**Process:**
1. Run tests in headed mode: `pnpm test:e2e:headed`
2. Watch where tests fail
3. Inspect actual UI elements
4. Update selectors in helpers and tests
5. Re-run until all pass

**Common selector issues:**
- `data-testid` attributes may not exist (use text or other selectors)
- Button text may differ (e.g., "Create" vs "Save")
- Form field names may differ
- Navigation links may have different text

**Verification:**
- [ ] All selectors match actual UI
- [ ] Tests use most reliable selectors (prefer `data-testid` > `role` > `text`)

### Task 6.3: Manual testing verification

**After E2E tests pass, manually verify:**
- [ ] Navigate through app using UI (not Playwright)
- [ ] Create a setlist manually → Works
- [ ] Start a playthrough with 2 players → Works
- [ ] Everything matches what tests verify

### Task 6.4: Document any discovered issues

**If issues found:**
- Create `notes.md` documenting:
  - What didn't work as expected
  - Workarounds used
  - Suggestions for UI improvements

**Verification:**
- [ ] Any deviations from design documented
- [ ] Any UI quirks noted for future reference

## Phase 7: Finalization

### Task 7.1: Update documentation

**Files to update:**
- [ ] Add comments to helpers explaining what they do
- [ ] Add JSDoc to helper functions
- [ ] Update README if needed

### Task 7.2: Clean up and commit

**Process:**
```bash
# Verify all tests pass
pnpm test:e2e

# Check git status
git status

# Add files
git add apps/frontend/e2e/

# Commit
git commit -m "Add E2E tests for pre-playthrough user flow

- Created user-journey.spec.ts for complete flow testing
- Created setlists.spec.ts for setlist management
- Created playthroughs.spec.ts for playthrough start
- Added setlists helper for programmatic setlist creation
- Updated playthroughs helper to match actual UI
- All tests passing (11 scenarios total)

Foundation for resuming playthrough stats entry tests.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Verification:**
- [ ] All new files committed
- [ ] Commit message describes changes clearly

### Task 7.3: Prepare to resume paused work

**Once this work is complete:**
1. [ ] Switch to `feature/playthrough-streamline-e2e-setup` branch
2. [ ] Merge main into that branch to get new helpers
3. [ ] Update playthrough stats tests to use working helpers
4. [ ] Complete stats entry E2E test suite
5. [ ] Merge both features

**Documentation:**
- [ ] Add note to paused branch's SETUP-COMPLETE.md about new helpers being available

## Success Criteria (All must be checked)

- [ ] All 3 test files created (`user-journey`, `setlists`, `playthroughs`)
- [ ] All tests passing without flakiness
- [ ] Helpers encapsulate UI interactions cleanly
- [ ] `playthroughs.ts` helper updated to match actual UI
- [ ] `setlists.ts` helper created and working
- [ ] Tests run in <2 minutes total
- [ ] Tests default to headless mode (already configured)
- [ ] Manual testing confirms tests match reality
- [ ] Code committed with clear commit message
- [ ] Foundation ready for resuming playthrough stats tests

## Estimated Effort

- **Phase 1:** Update helpers - 30-45 minutes
- **Phase 2:** Create setlist helpers - 30-45 minutes
- **Phase 3:** User journey test - 45-60 minutes
- **Phase 4:** Setlist tests - 30-45 minutes
- **Phase 5:** Playthrough tests - 30-45 minutes
- **Phase 6:** Verification & refinement - 30-60 minutes
- **Phase 7:** Finalization - 15-30 minutes

**Total: 3.5-5.5 hours**

## Notes

**Key principle:** Discover actual UI selectors through inspection, not assumption. Run tests in `--headed` mode to see what's actually on the page.

**When stuck:** Use Playwright's `.pause()` method to freeze execution and inspect the page:
```typescript
await page.pause(); // Opens Playwright Inspector
```

**Debugging tips:**
- Use `--headed` to watch tests run
- Use `--ui` for interactive debugging
- Check screenshots in `test-results/` on failure
- Run single test: `pnpm test:e2e user-journey.spec.ts`
