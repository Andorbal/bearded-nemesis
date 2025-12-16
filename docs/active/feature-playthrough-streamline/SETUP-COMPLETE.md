---
title: E2E Setup Complete - Ready to Run
type: feature
status: active
created_date: 2025-12-15
---

# ✅ E2E Setup Complete - Ready to Run!

## What's Been Done

### 1. ✅ Updated to iPhone 17 Pro
**Changed from:** iPhone 12 (2020, outdated)
**Changed to:** iPhone 17 Pro custom config

**Your Playwright tests now target:**
- **Viewport:** 430×932 (iPhone 17 Pro dimensions)
- **Device Scale:** 3x (Retina display)
- **User Agent:** iOS 19.0
- **Mobile:** Touch enabled, proper mobile context

**Why the custom config?**
Playwright's device presets lag behind latest devices. We're using iPhone 14 Pro Max as a base and overriding with iPhone 17 Pro specs to match your actual device!

---

### 2. ✅ Created E2E Test Data Seeder

**File:** `apps/api/src/db/seed-e2e.ts`

**What it does:**
- Uses existing `testuser` (created by main seed.ts)
- Creates a setlist named "Test Setlist"
- Adds 3 songs to the setlist
- Safe to run multiple times (uses ON CONFLICT)

**Credentials:**
- Username: `testuser`
- Password: `test123`
- Setlist: `Test Setlist` (3 songs)

**Script added to package.json:**
```bash
pnpm db:seed:e2e
```

---

### 3. ✅ Updated E2E Helpers

**File:** `apps/frontend/e2e/helpers/auth.ts`

**Changed:** Default password from `password` → `test123` to match existing test user

**Helper functions available:**
- `login(page, username, password)` - Authenticate
- `startPlaythrough(page, setlistName, difficulty)` - Begin playthrough
- `rateSong(page, rating)` - Rate song 1-5 stars
- `enterStats(page, stats)` - Fill stats form
- `advanceToNextSong(page)` - Move to next song
- `finishPlaythrough(page)` - Complete and view summary

---

## 🚀 Quick Start Guide

### Prerequisites (One-Time Setup)

**1. Install dependencies:**
```bash
cd /Users/andrewbenz/work/bearded-nemesis/bearded-nemesis
pnpm install
```

**2. Install Playwright browsers:**
```bash
cd apps/frontend
pnpm exec playwright install chromium
```

**3. Ensure database is seeded:**
```bash
# If you haven't run the main seed yet:
cd ../api
pnpm db:migrate
pnpm db:seed

# Then seed E2E test data:
pnpm db:seed:e2e
```

**Expected output:**
```
Seeding E2E test data...
Found test user with ID: 1
Found 3 songs for test setlist:
  - [Song 1 name]
  - [Song 2 name]
  - [Song 3 name]
Created/updated setlist "Test Setlist" with ID: 2
Added 3 songs to "Test Setlist"

✅ E2E test data seeded successfully!

E2E Test Credentials:
  Username: testuser
  Password: test123
  Setlist:  Test Setlist (3 songs)

Run E2E tests:
  cd apps/frontend && pnpm test:e2e
```

---

### Running E2E Tests

**1. Start backend services:**
```bash
# Terminal 1: Start PostgreSQL
docker-compose up -d postgres

# Terminal 2: Start API
cd apps/api
pnpm dev
```

**2. Run E2E tests:**
```bash
# Terminal 3: Run E2E tests
cd apps/frontend
pnpm test:e2e
```

**Available test commands:**
```bash
pnpm test:e2e           # Run all E2E tests
pnpm test:e2e:headed    # Run with visible browser
pnpm test:e2e:ui        # Interactive UI mode
pnpm test:e2e --project=mobile    # Only mobile tests
pnpm test:e2e --project=chromium  # Only desktop tests
pnpm test:e2e:report    # View HTML report after run
```

---

## 📊 What to Expect

### First Run (Likely Failures)

**Don't panic!** First E2E runs typically fail due to:
1. **Selector mismatches** - Form labels might differ from expected
2. **Missing UI elements** - Stats form might not be visible yet
3. **WebSocket timing** - Auto-save might need different wait strategy
4. **Navigation differences** - Button text might differ

**This is normal and expected!** We'll fix these together.

### Debugging Failures

**1. Run in headed mode to see what's happening:**
```bash
pnpm test:e2e:headed
```

**2. Check screenshots (auto-captured on failure):**
```
apps/frontend/test-results/
└── [test-name]/
    └── screenshot.png
```

**3. View HTML report:**
```bash
pnpm test:e2e:report
```

**4. Common fixes needed:**

**If login fails:**
- Check that login form inputs are named correctly
- Update `e2e/helpers/auth.ts` selectors

**If "My Stats" form not found:**
- Verify stats form is rendering during active playthrough
- Check that heading text is exactly "My Stats"
- Update `e2e/playthrough-stats-entry.spec.ts` selector

**If fields not found:**
- Check exact label text (e.g., "Completion" vs "Completion %")
- Update field selectors in helpers

**If auto-save not detected:**
- May need to wait for WebSocket event instead of HTTP request
- Adjust `waitForResponse` to `waitForTimeout`

---

## 🎯 Test Coverage

**11 E2E Scenarios:**
1. ✅ Entering stats for first song (8 fields, correct order)
2. ✅ Auto-save behavior (saves on blur)
3. ✅ Star rating with gold stars toggle
4. ✅ Field navigation (Enter/Tab advances)
5. ✅ Difficulty defaults to previous song
6. ✅ Pre-filled stats (editing existing)
7. ✅ Screenshot upload (NO OCR indicators)
8. ✅ Viewing stats in playthrough summary
9. ✅ Mobile numeric keyboard (inputmode attributes)
10. ✅ Mobile tap targets (44px minimum)

**Projects tested:**
- **Desktop Chrome** - Full functionality
- **Mobile (iPhone 17 Pro)** - Touch, keyboard, accessibility

---

## 📱 About the iPhone 17 Pro Config

**Why custom viewport?**
Playwright's device presets typically lag 1-2 years behind the latest devices. Since you have an iPhone 17 Pro, we created a custom config that:

1. **Starts with iPhone 14 Pro Max preset** (closest available in Playwright)
2. **Overrides viewport:** 430×932 (iPhone 17 Pro dimensions)
3. **Overrides user agent:** iOS 19.0 (latest)
4. **Maintains all mobile context:** Touch, scale factor, etc.

**Result:** Tests run as if on your actual iPhone 17 Pro! 🎯

**Fun fact:** We could also test on iPad Pro, Galaxy S24, or any other device by adding more projects to `playwright.config.ts`.

---

## 🔄 Re-Seeding Test Data

If you need to reset E2E test data:
```bash
cd apps/api
pnpm db:seed:e2e
```

This is safe to run multiple times - it updates the existing "Test Setlist" rather than creating duplicates.

---

## 🎓 Insight: Why Playwright for E2E?

`★ Insight ─────────────────────────────────────`
**Playwright vs. other E2E tools:**
- **Auto-waits** for elements to be ready (no flaky tests)
- **Multi-browser** support (Chrome, Firefox, Safari)
- **Mobile emulation** with real touch events
- **Network interception** for testing edge cases
- **Screenshot/video** debugging built-in

**Test helper pattern:**
- Encapsulates complex user flows
- Makes tests read like Gherkin scenarios
- Single source of truth for selectors
- Easy to maintain when UI changes

**iPhone 17 Pro targeting:**
- Ensures mobile UX matches your actual device
- Catches responsive layout issues early
- Verifies tap targets are accessible
- Tests numeric keyboards show correctly
`─────────────────────────────────────────────────`

---

## 📝 Next Steps

1. ✅ **Setup complete** - iPhone 17 Pro config, E2E seeder created
2. ⚠️ **Install deps** - Run `pnpm install` and `playwright install`
3. ⚠️ **Seed data** - Run `pnpm db:seed:e2e` in apps/api
4. ⚠️ **First run** - Run `pnpm test:e2e:headed` to see tests execute
5. ⚠️ **Fix selectors** - Update helpers based on failures
6. ⚠️ **Verify green** - Get all 11 scenarios passing

**Then:**
- Create component tests (NumberInput, StarRating, StatsForm)
- Create Storybook stories (14 total)
- Manual mobile device testing
- Ship it! 🚀

---

## 🆘 Need Help?

**E2E tests failing?**
- Run in headed mode: `pnpm test:e2e:headed`
- Check screenshots in `test-results/`
- View HTML report: `pnpm test:e2e:report`

**Seeder not working?**
- Ensure main seed ran first: `pnpm db:seed`
- Check that songs.sql exists in `seeds/`
- Verify PostgreSQL is running

**Selectors not matching?**
- Update `e2e/helpers/playthrough.ts` for form interactions
- Update `e2e/playthrough-stats-entry.spec.ts` for assertions
- Check exact label text in your components

---

## Summary

✅ **Playwright configured for iPhone 17 Pro**
✅ **E2E test seeder created (`pnpm db:seed:e2e`)**
✅ **11 executable scenarios ready to run**
✅ **Test helpers updated with correct credentials**

**Ready to run:** Just need `pnpm install`, `playwright install`, and `pnpm db:seed:e2e`!

🎯 **Goal:** Verify the manual stats entry workflow works end-to-end, from login → playthrough → stats entry → summary, on both desktop and your iPhone 17 Pro!
