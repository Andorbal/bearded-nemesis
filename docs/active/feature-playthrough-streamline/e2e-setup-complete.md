---
title: E2E Setup Complete - Next Steps
type: feature
status: active
created_date: 2025-12-15
---

# Playwright E2E Setup Complete ✅

## What Was Created

### 1. Playwright Configuration
**File:** `apps/frontend/playwright.config.ts`
- Desktop Chrome tests
- Mobile viewport tests (iPhone 12)
- Auto-starts dev server
- HTML report generation
- Screenshots on failure
- Trace on retry

### 2. E2E Test Helpers
**Files:**
- `apps/frontend/e2e/helpers/auth.ts` - Login/logout helpers
- `apps/frontend/e2e/helpers/playthrough.ts` - Playthrough operations

**Helper Functions:**
- `login(page, username, password)` - Authenticate user
- `startPlaythrough(page, setlistName, difficulty)` - Begin playthrough
- `rateSong(page, rating)` - Rate song 1-5 stars
- `enterStats(page, stats)` - Fill stats form with auto-save
- `advanceToNextSong(page)` - Move to next song
- `finishPlaythrough(page)` - Complete and view summary

### 3. Executable Specs
**File:** `apps/frontend/e2e/playthrough-stats-entry.spec.ts`

**11 Scenarios Implemented:**
1. ✅ Entering stats for the first song
2. ✅ Auto-save behavior
3. ✅ Star rating with gold stars
4. ✅ Field navigation with Enter key
5. ✅ Difficulty defaults to previous song
6. ✅ Pre-filled stats (editing existing)
7. ✅ Screenshot upload (no OCR indicators)
8. ✅ Viewing stats in playthrough summary
9. ✅ Mobile numeric keyboard behavior
10. ✅ Mobile tap target accessibility

### 4. Documentation
**File:** `apps/frontend/e2e/README.md`
- How to run E2E tests
- Test coverage overview
- Prerequisites and setup
- Debugging guide
- CI/CD configuration

### 5. Package.json Updates
**Scripts added:**
- `pnpm test` - Run component tests (Vitest)
- `pnpm test:e2e` - Run E2E tests (Playwright)
- `pnpm test:e2e:ui` - Interactive UI mode
- `pnpm test:e2e:headed` - Run with visible browser
- `pnpm test:e2e:report` - View HTML report

**Dependencies added:**
- `@playwright/test@^1.57.0` - E2E test framework
- `@testing-library/svelte@^5.0.0` - Component testing utilities
- `@testing-library/user-event@^14.0.0` - User interaction simulation

---

## Next Steps

### Step 1: Install Dependencies ⚠️

```bash
cd /Users/andrewbenz/work/bearded-nemesis/bearded-nemesis
pnpm install
```

This will install:
- @playwright/test
- @testing-library/svelte
- @testing-library/user-event

### Step 2: Install Playwright Browsers

```bash
cd apps/frontend
pnpm exec playwright install chromium
```

### Step 3: Set Up Test Data (REQUIRED)

The E2E tests require test data to exist:

**Option A: Create Database Seeder (Recommended)**
```bash
cd apps/api
# Create: src/db/seeds/e2e-test-data.ts
# Seed:
#   - User: username="testuser", password="password"
#   - Setlist: name="Test Setlist" with 3+ songs
pnpm db:seed
```

**Option B: Manual Setup**
1. Start the app
2. Create user "testuser" with password "password"
3. Create setlist "Test Setlist" with at least 3 songs
4. Note: This data persists in the test database

### Step 4: Run E2E Tests (Dry Run)

```bash
cd apps/frontend

# Start backend services first
cd ../.. && docker-compose up -d postgres
cd apps/api && pnpm dev &

# Run E2E tests
cd ../frontend
pnpm test:e2e
```

**Expected Result:**
- Some tests may fail (implementation might not match selectors)
- Goal: Verify tests run and can interact with the app

### Step 5: Fix Selector Mismatches

Review test failures and update selectors in:
- `e2e/helpers/playthrough.ts` - If form fields use different labels
- `e2e/playthrough-stats-entry.spec.ts` - If assertions use wrong text

Common mismatches:
- Form field labels might differ
- Button text might differ
- Section headers might differ

### Step 6: Component Tests

Create component tests for:
1. NumberInput (6 missing tests)
2. StarRatingWithGold (all 7 tests)
3. PlaythroughStatsForm (all 7 tests)

See: `remaining-work-plan.md` for detailed test specs

### Step 7: Storybook Stories

Create stories for all 3 components (14 total stories)

### Step 8: Manual Mobile Testing

Test on actual mobile device or emulator

---

## Test Execution Flow (Following benzhaus Workflow)

**Phase 0: Write Specifications** ✅ COMPLETE
- Created `specs.md` with Gherkin scenarios
- Created executable Playwright specs

**Phase 1-6: Implementation** ✅ COMPLETE
- Core components created (NumberInput, StarRatingWithGold, PlaythroughStatsForm)
- Database schema updated
- API endpoints implemented

**Phase N+1: Verify Specifications** ⚠️ PENDING
- Run E2E specs: `pnpm test:e2e`
- Fix any failing specs
- Ensure 100% spec pass rate

---

## File Structure

```
apps/frontend/
├── e2e/
│   ├── helpers/
│   │   ├── auth.ts           # Authentication helpers
│   │   └── playthrough.ts    # Playthrough operations
│   ├── playthrough-stats-entry.spec.ts  # Main E2E specs
│   └── README.md             # Documentation
├── playwright.config.ts      # Playwright configuration
└── package.json             # Updated with test scripts
```

---

## Current Status

**✅ Complete:**
- Playwright setup
- E2E test structure
- 11 executable scenarios
- Helper functions
- Documentation
- Package.json configuration

**⚠️ Blocked (Needs Action):**
- Install dependencies: `pnpm install`
- Install Playwright browsers
- **Create test data** (critical!)
- Run tests to verify

**❌ Not Started:**
- Component tests (NumberInput, StarRatingWithGold, PlaythroughStatsForm)
- Storybook stories
- Manual mobile testing

---

## Estimated Time to Green Tests

Assuming test data is set up:
- Install dependencies: 2 minutes
- Install Playwright browsers: 3 minutes
- First test run: 2 minutes
- Fix selector mismatches: 30-60 minutes
- Verify all specs pass: 10 minutes

**Total: ~1-1.5 hours to get E2E tests passing**

---

## Questions to Resolve

1. **Test Data:** Should we create a database seeder or use manual setup?
2. **Selectors:** Are form labels exactly as shown in specs? (e.g., "Completion", "Skill Level", etc.)
3. **Authentication:** Does login flow match helper implementation?
4. **Playthrough Flow:** Are button texts "Next" and "Finish" correct?

---

## Recommendation

**Next immediate step: Install dependencies and run a dry run**

```bash
# From project root
pnpm install

# Install Playwright browsers
cd apps/frontend
pnpm exec playwright install chromium

# Start services
docker-compose up -d postgres
cd ../api && pnpm dev &

# Run E2E tests (expect failures, that's OK!)
cd ../frontend
pnpm test:e2e --headed
```

This will show us what selector/implementation mismatches exist and what needs to be fixed.
