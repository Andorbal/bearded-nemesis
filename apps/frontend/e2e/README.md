# E2E Tests - Playthrough Stats Entry

Executable Playwright specifications for the manual stats entry workflow.

## Overview

These E2E tests verify the complete user journey for entering stats during an active playthrough, based on the BDD specifications in `docs/active/feature-playthrough-streamline/specs.md`.

## Test Coverage

**Critical User Flows:**
1. ✅ Entering stats for the first song
2. ✅ Auto-save behavior
3. ✅ Star rating with gold stars toggle
4. ✅ Field navigation with Enter/Tab keys
5. ✅ Difficulty defaults to previous song
6. ✅ Pre-filled stats (editing existing)
7. ✅ Screenshot upload (no OCR indicators)
8. ✅ Viewing stats in playthrough summary
9. ✅ Mobile numeric keyboard behavior
10. ✅ Mobile tap target accessibility

## Prerequisites

### Database & API Setup

The E2E tests require:
1. **PostgreSQL** running with test database
2. **API server** running on port 3010
3. **Test data** seeded (setlist with 3+ songs)

**Setup:**
```bash
# 1. Start PostgreSQL
docker-compose up -d postgres

# 2. Run migrations
cd apps/api
pnpm db:migrate

# 3. Seed test data (if seeder exists)
pnpm db:seed

# 4. Start API
pnpm dev
```

### Frontend Dev Server

The Playwright config automatically starts the frontend dev server, but you can also run it manually:
```bash
cd apps/frontend
pnpm dev
```

## Running Tests

### Run all E2E tests
```bash
cd apps/frontend
pnpm test:e2e
```

### Run specific test file
```bash
pnpm test:e2e playthrough-stats-entry
```

### Run in headed mode (see browser)
```bash
pnpm test:e2e --headed
```

### Run in UI mode (interactive)
```bash
pnpm test:e2e --ui
```

### Run only mobile tests
```bash
pnpm test:e2e --project=mobile
```

### Run only desktop tests
```bash
pnpm test:e2e --project=chromium
```

## Test Data Requirements

**Minimum test data needed:**
- 1 test user (username: `testuser`, password: `password`)
- 1 setlist named "Test Setlist" with at least 3 songs
- Songs should have varying difficulties for realistic testing

**TODO:** Create database seeder or API fixtures to set up test data consistently.

## Debugging

### View test report
```bash
pnpm playwright show-report
```

### Generate trace
Traces are automatically generated on first retry. View them:
```bash
pnpm playwright show-trace trace.zip
```

### Take screenshots on failure
Screenshots are automatically saved to `test-results/` on failure.

### Verbose logging
```bash
DEBUG=pw:api pnpm test:e2e
```

## CI/CD

Tests run in CI with:
- 2 retries
- 1 worker (serial execution)
- HTML report artifact

## Known Limitations

1. **Test Data Setup:** Currently requires manual setup of test data (setlist, songs, user). Future: Create database seeder or use API fixtures.

2. **WebSocket Testing:** Tests use `waitForTimeout()` for auto-save. Future: Wait for WebSocket events or network requests explicitly.

3. **File Upload:** Screenshot upload uses mock file. Future: Test with actual image files.

4. **Mobile Testing:** Uses viewport emulation. Future: Test on real devices via BrowserStack/Sauce Labs.

## Maintenance

### Updating selectors
If UI changes, update selectors in:
- `e2e/helpers/playthrough.ts` - Common operations
- `e2e/playthrough-stats-entry.spec.ts` - Test assertions

### Adding new scenarios
1. Add Gherkin scenario to `specs.md`
2. Create executable Playwright test
3. Update this README with new coverage

## Related Documentation

- **BDD Specs:** `docs/active/feature-playthrough-streamline/specs.md`
- **Implementation Plan:** `docs/active/feature-playthrough-streamline/remaining-work-plan.md`
- **Playwright Docs:** https://playwright.dev/
