---
title: E2E Tests for Login, Setlist Creation, and Playthrough Start Flow
type: feature
status: active
created_date: 2025-12-15
gitlab_issue: null
gitlab_mr: null
---

# E2E Tests for Login, Setlist Creation, and Playthrough Start Flow

## Overview

### Primary Objective
Create comprehensive Playwright E2E tests covering the user journey from login through creating a setlist and starting a playthrough. These tests will validate the core user workflows and provide a foundation for the playthrough stats entry tests (currently paused on branch `feature/playthrough-streamline-e2e-setup`).

### Scope

**In Scope:**
- Login authentication flow
- Navigation through the application using the nav menu
- Manual setlist creation with song selection
- Setlist validation (cannot create without name)
- Starting a playthrough with 1 player
- Starting a playthrough with 2 players
- Playthrough validation (cannot start without setlist)
- Verification that first song loads in active playthrough

**Out of Scope:**
- Smart or builder setlist types (manual only)
- Advanced song search/filtering (simple addition only)
- More than 2 players (1-2 players sufficient)
- Detailed validation scenarios (component tests handle these)
- Playthrough stats entry (separate feature on paused branch)

## Problem Statement

The playthrough stats entry E2E tests (on `feature/playthrough-streamline-e2e-setup` branch) are currently blocked because they make assumptions about the UI flow that don't match the actual implementation. Specifically:

1. **Login flow** - Partially working but needs refinement
2. **Setlist selection** - Assumes setlist exists; need tests for creating setlists
3. **Playthrough start** - Helper assumes simple difficulty selector, but actual UI has per-player instrument/difficulty selection with "+ Add Player" functionality

By building E2E tests for the pre-playthrough flow, we:
- Establish working helper functions that match the actual UI
- Verify the complete user journey works end-to-end
- Provide a solid foundation for resuming the playthrough stats tests

## Proposed Solution

### Approach

**Hybrid test organization** - Combine journey testing with feature-specific tests:

1. **`user-journey.spec.ts`** - One comprehensive test showing the complete flow with real UI navigation
2. **`setlists.spec.ts`** - Focused tests for setlist creation using direct URLs (faster)
3. **`playthroughs.spec.ts`** - Focused tests for playthrough start using direct URLs (faster)

This approach gives us both verification of the complete user experience AND fast, isolated feature tests.

### Test Coverage Strategy

**Happy path + critical validation:**
- Focus on scenarios that verify core functionality works
- Test critical validation errors that block users (e.g., can't create setlist without name)
- Skip exhaustive validation scenarios (those belong in component tests)

**Navigation strategy:**
- One test (`user-journey.spec.ts`) verifies clicking through nav menu works
- Other tests use direct URLs for speed
- This balances verification with test performance

### Alternatives Considered

**Alternative 1: Single large test suite**
- One big test file with all scenarios
- **Rejected:** Harder to debug, slower to run, less modular

**Alternative 2: Separate test files only (no journey test)**
- Each feature tested in isolation with direct URLs
- **Rejected:** Doesn't verify the complete user navigation flow works

**Alternative 3: Comprehensive multi-player testing**
- Test 1, 2, 3, and 4 player scenarios
- **Rejected:** Overkill for E2E tests; 1 and 2 players sufficient to verify "+ Add Player" works

## Implementation Details

### Test Files to Create

**1. `apps/frontend/e2e/user-journey.spec.ts`**

Complete user journey test:
```typescript
test('complete user journey: login → create setlist → start playthrough', async ({ page }) => {
  // 1. Login via UI (click Login button in nav)
  // 2. Click "Setlists" in navigation menu
  // 3. Click "Create New Setlist" button
  // 4. Fill in setlist name: "E2E Test Setlist"
  // 5. Select type: "Manual"
  // 6. Add 3 songs from available list
  // 7. Save setlist
  // 8. Verify setlist appears in list
  // 9. Click "Playthroughs" in navigation menu
  // 10. Click "Start New Playthrough"
  // 11. Select "E2E Test Setlist" from dropdown
  // 12. Select instrument: drums, difficulty: expert
  // 13. Click "Start Playthrough"
  // 14. Verify first song loads (check for song title, rating UI, My Stats form)
});
```

**Purpose:** Validates complete user experience with real navigation.

---

**2. `apps/frontend/e2e/setlists.spec.ts`**

Focused setlist testing (uses direct URLs):

```typescript
// Test 1: Create manual setlist successfully (happy path)
test('can create a manual setlist with songs', async ({ page }) => {
  await login(page);
  await page.goto('/setlists');

  // Create setlist named "My Rock Setlist"
  // Add 3 songs
  // Save
  // Verify it appears in the setlist list
});

// Test 2: Cannot create setlist without a name (validation)
test('cannot create setlist without a name', async ({ page }) => {
  await login(page);
  await page.goto('/setlists/new');

  // Leave name field empty
  // Try to save
  // Verify error message appears
  // Verify setlist was NOT created
});

// Test 3: View created setlist details
test('can view setlist details after creation', async ({ page }) => {
  await login(page);

  // Create a setlist (using helper)
  // Click on the setlist to view details
  // Verify all 3 songs appear in correct order
  // Verify setlist name and type are correct
});
```

---

**3. `apps/frontend/e2e/playthroughs.spec.ts`**

Focused playthrough testing (uses direct URLs):

```typescript
// Test 1: Start playthrough with single player (happy path)
test('can start playthrough with single player', async ({ page }) => {
  await login(page);

  // Use helper to create a test setlist
  const setlist = await createTestSetlist(page);

  await page.goto('/playthroughs/start');

  // Select the test setlist from dropdown
  // Default player should be present
  // Select instrument: guitar, difficulty: hard
  // Click "Start Playthrough"
  // Verify first song loads with correct player info
});

// Test 2: Start playthrough with two players
test('can start playthrough with two players', async ({ page }) => {
  await login(page);

  const setlist = await createTestSetlist(page);
  await page.goto('/playthroughs/start');

  // Select setlist
  // Player 1: drums, expert
  // Click "+ Add Player"
  // Player 2: guitar, hard
  // Click "Start Playthrough"
  // Verify both players appear in active playthrough
});

// Test 3: Cannot start without selecting setlist (validation)
test('cannot start playthrough without selecting setlist', async ({ page }) => {
  await login(page);
  await page.goto('/playthroughs/start');

  // Select instrument/difficulty but no setlist
  // Click "Start Playthrough"
  // Verify error message or disabled button
});
```

### Helper Functions

**`e2e/helpers/auth.ts`** (Already exists ✅)
```typescript
async function login(page, username = 'testuser', password = 'test123')
async function logout(page)
```

**`e2e/helpers/setlists.ts`** (NEW)
```typescript
// Create a setlist programmatically for tests that need one
async function createTestSetlist(page, options = {}) {
  // Navigate to setlist creation
  // Fill in name (default: "Test Setlist {timestamp}")
  // Select type: manual
  // Add songs (default: first 3 available)
  // Save
  // Return setlist info (name, id if available)
}

// Add songs to a setlist
async function addSongsToSetlist(page, songCount = 3) {
  // Click add song buttons
  // Select first N songs from available list
}

// Verify setlist appears in list
async function verifySetlistExists(page, setlistName) {
  // Check that setlist name appears in the list
  // Return true/false
}
```

**`e2e/helpers/playthroughs.ts`** (UPDATE existing)
```typescript
// FIX: Update to match actual UI (from screenshot)
async function startPlaythrough(page, setlistName, players = []) {
  // Select setlist from dropdown
  // For each player: set instrument and difficulty
  // Handle "+ Add Player" if multiple players
  // Click "Start Playthrough" button
  // Wait for active playthrough page to load
}

// NEW: Verify playthrough started correctly
async function verifyPlaythroughStarted(page, expectedSongTitle) {
  // Check first song title is visible
  // Check player info is displayed
  // Check My Stats form exists (if that's what we're building toward)
}
```

### Test Data Strategy

**Database seeding:**
- Reuse existing `apps/api/src/db/seed-e2e.ts`
- Already creates `testuser` (username: testuser, password: test123) ✅
- Already creates "Test Setlist" with 3 songs ✅
- Already seeds songs from `seeds/songs.sql` ✅
- No additional seeding needed!

**Dynamic test data:**
- Create unique setlist names using timestamps: `"E2E Test ${Date.now()}"`
- Prevents conflicts when tests run multiple times
- No cleanup needed - let test data accumulate in test database

**Cleanup strategy:** None (Option A)
- Test database can accumulate data without issue
- Faster test execution
- Can manually reset with `pnpm db:reset && pnpm db:seed && pnpm db:seed:e2e` if needed

### Assertions & Verification

**What to verify in each test:**

**User Journey Test:**
```typescript
// After each major step, verify we're on the right page
await expect(page).toHaveURL('/setlists');
await expect(page.locator('h1')).toContainText('Setlists');

// After creating setlist, verify it exists
await expect(page.locator(`text=${setlistName}`)).toBeVisible();

// After starting playthrough, verify ALL of:
await expect(page).toHaveURL(/\/playthroughs\/\d+/); // Active playthrough URL
await expect(page.locator('h2')).toContainText(expectedSongTitle);
await expect(page.locator('text=My Rating')).toBeVisible(); // Rating section exists
```

**Setlist Tests:**
```typescript
// Successful creation
await expect(page.locator(`text=${setlistName}`)).toBeVisible();

// Failed validation
await expect(page.locator('text=/name is required/i')).toBeVisible();
await expect(page).toHaveURL('/setlists/new'); // Still on form page
```

**Playthrough Tests:**
```typescript
// Successful start
await expect(page).toHaveURL(/\/playthroughs\/\d+/);
await expect(page.locator('[data-testid="player-1"]')).toBeVisible(); // Or similar

// Failed validation
await expect(page.locator('text=/select a setlist/i')).toBeVisible();
```

**Principle:** Verify the outcome the user would see, not implementation details.

### Dependencies

**Existing infrastructure:**
- Playwright already configured (from paused branch)
- `playwright.config.ts` with iPhone 17 Pro + Desktop Chrome
- `e2e/helpers/auth.ts` working
- Database seeder `seed-e2e.ts` working

**New dependencies:**
- None! Uses existing Playwright setup

### Files to Modify/Create

**Create:**
- `apps/frontend/e2e/user-journey.spec.ts`
- `apps/frontend/e2e/setlists.spec.ts`
- `apps/frontend/e2e/playthroughs.spec.ts`
- `apps/frontend/e2e/helpers/setlists.ts`

**Modify:**
- `apps/frontend/e2e/helpers/playthroughs.ts` - Fix to match actual UI

**Reuse:**
- `apps/frontend/e2e/helpers/auth.ts` - No changes needed ✅
- `apps/frontend/playwright.config.ts` - No changes needed ✅
- `apps/api/src/db/seed-e2e.ts` - No changes needed ✅

## Testing Strategy

### How to Test This Work

**Running E2E tests:**
```bash
# Start services first
docker-compose up -d postgres
cd apps/api && pnpm dev &

# Run all E2E tests
cd apps/frontend
pnpm test:e2e

# Run specific test file
pnpm test:e2e user-journey
pnpm test:e2e setlists
pnpm test:e2e playthroughs

# Run with visible browser (for debugging)
pnpm test:e2e:headed
```

**Prerequisites:**
- PostgreSQL running
- API server running
- Test database seeded: `pnpm db:seed:e2e`

**Verification:**
- All tests pass (green)
- Tests complete in reasonable time (<2 minutes total)
- No flaky failures on re-runs

### Manual Testing

After E2E tests pass, manually verify:
1. Navigate through app using UI (not Playwright)
2. Create a setlist manually
3. Start a playthrough with 2 players
4. Verify everything works as expected

## Success Criteria

- [ ] All 3 E2E test files created and passing
- [ ] `user-journey.spec.ts` validates complete flow with navigation
- [ ] `setlists.spec.ts` validates setlist creation + critical validation
- [ ] `playthroughs.spec.ts` validates 1 & 2 player scenarios + validation
- [ ] Helper functions encapsulate UI interactions cleanly
- [ ] `playthroughs.ts` helper updated to match actual UI
- [ ] Tests run reliably without flakiness
- [ ] Tests provide foundation for resuming playthrough stats tests
- [ ] All tests default to headless mode (already configured ✅)
- [ ] Test output is clear and debuggable

## Connection to Paused Work

Once these tests are complete and passing, we can:
1. Resume the `feature/playthrough-streamline-e2e-setup` branch
2. Update the playthrough stats entry tests to use the working helpers
3. Complete the stats entry E2E test suite
4. Merge both features

**Branch relationship:**
- **This work (main):** Pre-playthrough E2E tests (login → start playthrough)
- **Paused work (feature/playthrough-streamline-e2e-setup):** Playthrough stats entry E2E tests

**Why this approach:**
Building from the foundation up ensures each layer works before building the next. The stats entry tests depend on the playthrough start flow working correctly, so we test that first.

## Open Questions

None - design is validated through brainstorming session.
