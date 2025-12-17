---
title: E2E Pre-Playthrough Tests - Notes
type: feature
status: active
created_date: 2025-12-15
---

# Implementation Notes

## Decision: Skip Separate Executable Specifications

**Date:** 2025-12-15

**Decision:** Skip writing separate executable specifications (BDD/Gherkin)

**Reason:** The E2E tests themselves ARE the executable specifications. They verify the user acceptance criteria and describe the expected behavior. Writing separate BDD specs would be redundant.

**Trade-off:** E2E tests serve dual purpose:
- ✅ Verify functionality works
- ✅ Document expected behavior
- ✅ Act as living specifications

No separate spec layer needed for this work.

## Context: Paused Work

This feature builds the foundation for the playthrough stats entry E2E tests that are currently paused on branch `feature/playthrough-streamline-e2e-setup`.

**Why this work is needed:**
The stats entry tests discovered that several helper functions made incorrect assumptions about the UI:
- Login flow timing issues (fixed)
- Playthrough start UI structure (per-player instrument/difficulty with "+ Add Player")
- Setlist creation flow (needed for test data setup)

By building E2E tests for the pre-playthrough flow first:
1. We establish correct helper functions that match the actual UI
2. We verify the complete user journey works end-to-end
3. We provide a solid foundation for the stats entry tests to build upon

**Branch relationship:**
- **This work (main):** Pre-playthrough E2E tests (login → start playthrough)
- **Paused work (feature/playthrough-streamline-e2e-setup):** Playthrough stats entry E2E tests

Once this work is complete, we can resume the paused branch and update it to use the working helpers.

## Implementation Approach

**Hybrid test organization:**
- One comprehensive journey test (verifies complete flow with navigation)
- Feature-specific tests using direct URLs (faster, isolated)
- Reusable helpers encapsulate UI interactions

This gives us both:
- ✅ Verification of complete user experience
- ✅ Fast, isolated feature tests
- ✅ Easy debugging when something breaks

## Key Discoveries

### Actual UI Structure vs Assumptions

**Setlist Creation Flow:**
- ❌ WRONG: Assumed song selection on creation form
- ✅ ACTUAL: Create container first (name only), then add songs on detail page
- ✅ ACTUAL: Songs added via search + "+ Add" buttons
- ✅ ACTUAL: No type selector (hardcoded to 'manual')

**Song Adding Behavior:**
- ❌ WRONG: Search results persist after adding a song
- ✅ ACTUAL: Search results clear after each add (to show updated setlist)
- ✅ FIX: Re-search before each song add to maintain UI state

**Button/Link Text:**
- Button to create setlist: "+ Manual Setlist" (not "Create New Setlist")
- Button to save setlist: "Create Setlist" (not "Save")
- Button on song cards: "+ Add" (exact text)
- Validation toast: "Please enter a setlist name" (exact text)

**Start Playthrough Page:**
- Route: `/playthroughs/new` (not `/playthroughs/start`)
- Setlist select: `#setlist` (id selector)
- Per-player configuration with instrument + difficulty dropdowns
- "+ Add Player" button for additional players
- Select elements use nth-based indexing (setlist=0, player1 instrument=1, player1 difficulty=2, etc.)

### SSR Issues Fixed

**Problem:** `document is not defined` error during server-side rendering
**Location:** `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte:111`
**Fix:** Added `browser` guards around all `document` API usage:
```typescript
import { browser } from '$app/environment';

if (browser) {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}
```

### Database Schema Bug - FIXED

**2-Player Playthrough API Error (RESOLVED):**

**Date Discovered:** 2025-12-15
**Date Fixed:** 2025-12-16

**Root Cause:**
- Database constraint: `PRIMARY KEY (playthrough_id, user_id)` in `playthrough_players` table
- Frontend sets all players to same `userId` (current logged-in user)
- When adding 2nd player with same userId → duplicate key violation → 400 error

**Why This Happened:**
- Original schema assumed: different users per playthrough (multiplayer sessions)
- Actual usage: solo players playing multiple instruments (common in Rock Band)

**Fix Applied:**
- Created migration `006_allow_multi_instrument_per_user.sql`
- Changed primary key to: `PRIMARY KEY (playthrough_id, user_id, instrument)`
- Now allows: Same user, multiple instruments (e.g., drums + guitar)
- Still prevents: Same user, same instrument twice (e.g., 2x drums)

**Files Changed:**
- `apps/api/src/db/migrations/006_allow_multi_instrument_per_user.sql` - New migration

**Verification:**
- 2-player E2E tests now pass ✅

### Future UI Consideration: Multi-Instrument Stats Entry

**Issue:** When a single user plays multiple instruments in one playthrough, the stats entry UI needs to handle per-instrument ratings.

**Current Behavior:**
- Stats entry page shows player's instrument from `playthrough_players`
- For multi-instrument scenarios, need to determine which instrument's stats to collect

**Proposed Solution (Not Yet Implemented):**
- Pick the first instrument the player selected for stats entry
- Display both instruments in the UI for awareness
- Future enhancement: Allow switching between instruments for separate stats

**Location for Future Work:**
- `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte` - Active playthrough page
- Database already supports per-instrument stats via `playthrough_players.instrument`

**Note:** This is a rare edge case (most users play one instrument per session). Defer until user feedback indicates it's needed.
