---
title: Playthrough Streamline
type: feature
status: active
created_date: 2025-12-09
started_date: 2025-12-09
repositories:
  - bearded-nemesis
---

# Playthrough Streamline - Design Document

## Overview

This design streamlines the playthrough workflow by removing OCR from the active flow and implementing manual stats entry optimized for mobile devices. The goal is to make the app immediately useful while preserving the option to re-enable OCR later.

## Motivation

OCR has been a bottleneck preventing the app from being useful. By pivoting to quick manual entry that works now, we can:
- Make the app immediately usable
- Still collect screenshot images for future OCR processing
- Gather real usage data on what stats matter most
- Preserve all OCR infrastructure for later re-enablement

## Design Details

### 1. OCR Removal Strategy

**Keep in docker-compose.yml:**
- Solver service (still needed for LP optimization)

**Remove from solver service:**
- PaddleOCR dependencies from `apps/solver/Dockerfile` and `requirements.txt`
- OCR-related routes/endpoints from FastAPI app
- OCR processing logic

**Keep in solver service:**
- Linear programming optimization code and endpoints
- Dependencies for LP solving (PuLP, etc.)

**Remove from frontend:**
- OCR status indicators from active playthrough UI
- "Re-run OCR" button functionality
- WebSocket OCR event handlers during active playthroughs

**Keep in frontend/API:**
- Screenshot upload functionality (still stores images)
- Screenshot viewing in finished playthrough summary
- All OCR database columns (`ocrStatus`, `ocrError`, `ocrProcessedAt`) for future re-enablement

**Documentation:**
- Create `docs/removed-features/ocr-2025-12-09.md` documenting:
  - What was removed and why
  - Last working commit SHA
  - Current OCR code location (`apps/solver/app/`)
  - Steps to re-enable OCR in the future

### 2. Database Schema Changes

Add two columns to `playthrough_song_stats` table:

```sql
-- Migration: 008_add_difficulty_and_multiplier.sql
ALTER TABLE playthrough_song_stats
  ADD COLUMN difficulty VARCHAR(10),  -- 'easy', 'medium', 'hard', 'expert'
  ADD COLUMN avg_multiplier DECIMAL(4,1);  -- e.g., 3.8
```

**Rationale:**
- `difficulty`: Players can change skill level per-song in Rock Band 4 (not just playthrough-level)
- `avg_multiplier`: Missing stat from the game's results screen

**Type updates:**
Update `PlaythroughSongStats` interface in `packages/shared/src/types.ts`:

```typescript
export interface PlaythroughSongStats {
  // ... existing fields ...
  difficulty: Difficulty | null;
  avgMultiplier: number | null;
}
```

### 3. Active Playthrough Stats Entry Form

**Location:**
Active playthrough page (`/playthroughs/[id]/+page.svelte`), positioned between "Rate This Song" card and "Upload Screenshot" card

**Key Behavior:**
- Only shows **current user's** stats form (not other players)
- Form is always visible (no "Edit Stats" button)
- Auto-saves each field on blur
- Fields advance on Enter/Tab keypress for rapid entry

**Field Layout (Top to Bottom - Matches Rock Band Results Screen Order):**

**Results Section:**
1. **Completion %** - Number input, shows "%" suffix
2. **Skill Level** - Dropdown (easy/medium/hard/expert)
   - Defaults to previous song's difficulty, or player's playthrough difficulty
3. **Score** - Number input
4. **Stars** - 5-star selector with gold toggle
   - Stars turn gold when "Gold" toggle is enabled
   - Gold toggle auto-disables when <5 stars selected
   - Stores as 6 in database when gold is active

**Performance Section:**
5. **Longest Streak** - Number input
6. **Notes Hit** - Number input
7. **Notes Missed** - Number input
8. **Avg. Multiplier** - Number input (decimal, e.g., 3.8)

**Mobile Optimization:**
- Large tap targets (min 44px height)
- Number inputs use `inputmode="numeric"` for mobile numeric keyboard
- Single column layout for phone screens
- Auto-save on blur (no manual Save button needed)

### 4. Component Architecture

**New Atomic Components:**

**`NumberInput.svelte`** - Number input with navigation and auto-save
- Props: `value`, `label`, `suffix` (optional), `onSave`, `inputmode`, `step`, `min`, `max`
- Behavior:
  - Auto-saves on blur
  - Advances focus on Enter key
  - Advances focus on Tab key
  - Displays suffix after input (e.g., "%")

**`StarRatingWithGold.svelte`** - 5-star selector with gold toggle
- Props: `stars` (1-6), `onSelect`, `interactive`
- Behavior:
  - Renders 5 tappable stars
  - Shows "Gold" toggle to right of stars (only when 5 selected)
  - Turns all 5 stars gold when toggle is on
  - Auto-disables gold toggle when user selects <5 stars
  - Calls `onSelect(6)` when gold is active

**New Composite Component:**

**`PlaythroughStatsForm.svelte`** - Complete stats entry form
- Props:
  - `playthroughId` - Current playthrough ID
  - `position` - Current song position
  - `currentUserId` - Logged-in user ID
  - `existingStats` - Pre-filled stats if editing
  - `playerDifficulty` - User's playthrough difficulty (fallback)
  - `previousSongDifficulty` - Difficulty from previous song (preferred default)
- Uses: `NumberInput`, `StarRatingWithGold`, native `<select>`
- Handles: Auto-save logic, field navigation, form state management

**Modified Components:**

**`PlaythroughSongCard.svelte`** (summary view)
- Remove OCR status indicators
- Keep screenshot viewing functionality

**`ScreenshotModal.svelte`**
- Remove "Re-run OCR" button

**`/playthroughs/[id]/+page.svelte`** (active playthrough)
- Add `PlaythroughStatsForm` between rating and screenshot cards
- Remove OCR WebSocket event handlers
- Keep screenshot upload functionality

### 5. Storybook Stories

Create stories for comprehensive component documentation and visual testing:

**`NumberInput.stories.ts`:**
- Default state (empty)
- Pre-filled value
- With suffix (percentage example)
- With validation (min/max example)
- Decimal input (avg multiplier example)

**`StarRatingWithGold.stories.ts`:**
- Interactive mode (all states 1-5, gold on/off)
- Display mode (non-interactive)
- Various star counts with/without gold

**`PlaythroughStatsForm.stories.ts`:**
- Empty form (new song, no existing stats)
- Pre-filled form (editing existing stats)
- Different difficulty defaults (playthrough vs previous song)
- Mobile viewport (375px width)

**Environment Note:**
When running in a yolo container, Storybook won't auto-open a browser. The implementation agent should:
1. Instruct the user to manually start Storybook with: `pnpm --filter @bearded-nemesis/frontend story:dev`
2. Provide the local URL for the user to open in their browser

### 6. Testing Strategy

**Frontend Component Tests:**

**`NumberInput.test.ts`:**
- Renders with label and initial value
- Calls `onSave` when field loses focus
- Advances focus on Enter key
- Advances focus on Tab key
- Displays suffix correctly
- Respects min/max validation
- Uses correct `inputmode` attribute

**`StarRatingWithGold.test.ts`:**
- Renders 5 stars initially
- Calls `onSelect` when star clicked
- Shows gold toggle only when 5 stars selected
- Applies gold styling when toggle is on
- Auto-disables gold when <5 stars selected
- Returns value of 6 when gold is active

**`PlaythroughStatsForm.test.ts`:**
- Renders all 8 fields in correct order
- Pre-fills with existing stats
- Defaults difficulty to previous song's difficulty
- Falls back to playthrough difficulty if no previous song
- Calls API to save each field on blur
- Handles save errors gracefully
- Tab order flows through fields correctly

**API Tests:**

**Update `apps/api/src/routes/playthroughs.test.ts`:**
- Test updating stats with `difficulty` and `avgMultiplier`
- Verify difficulty validation (only 'easy', 'medium', 'hard', 'expert' accepted)
- Verify avgMultiplier accepts decimals
- Test that users can only update their own stats during active playthrough

**Repository Tests:**
- Verify new columns are saved correctly
- Verify new columns are retrieved correctly
- Test null handling for optional fields

**Migration Testing:**
- Run migration on test database
- Verify columns created with correct types
- Verify existing data unaffected
- Test rollback if needed

### 7. Implementation Order

**Phase 1: Documentation & Cleanup (Non-breaking)**
1. Document OCR removal in `docs/removed-features/ocr-2025-12-09.md`
2. Record current commit SHA as "last working OCR version"
3. Remove PaddleOCR from solver Dockerfile and requirements.txt
4. Remove OCR endpoints from solver FastAPI app
5. Rebuild solver Docker image, verify LP optimization still works

**Phase 2: Database & Types (Foundation)**
6. Create migration `008_add_difficulty_and_multiplier.sql`
7. Run migration using **existing DATABASE_URL environment variable** (NOT .env file)
8. Update `PlaythroughSongStats` interface in `packages/shared/src/types.ts`
9. Rebuild shared package: `pnpm --filter @bearded-nemesis/shared build`
10. Update API repository methods to handle new fields

**Phase 3: Atomic Components + Storybook (Build bottom-up)**
11. Create `NumberInput.svelte` with tests
12. Create `NumberInput.stories.ts`
13. Create `StarRatingWithGold.svelte` with tests
14. Create `StarRatingWithGold.stories.ts`
15. **Instruct user to manually start Storybook** (yolo container won't auto-open browser)
16. Verify stories render correctly

**Phase 4: Composite Form + Integration**
17. Create `PlaythroughStatsForm.svelte` with tests
18. Create `PlaythroughStatsForm.stories.ts`
19. Update API endpoint to accept difficulty and avgMultiplier in stats updates
20. Add API endpoint tests for new fields
21. Integrate `PlaythroughStatsForm` into active playthrough page

**Phase 5: Remove OCR from Frontend**
22. Remove OCR status indicators from `PlaythroughSongCard.svelte`
23. Remove "Re-run OCR" button from `ScreenshotModal.svelte`
24. Remove OCR WebSocket event handlers from playthrough page
25. Keep screenshot upload and viewing functionality
26. Run all frontend tests, ensure they pass

**Phase 6: Final Verification**
27. Test complete flow: start playthrough → enter stats → advance song → verify saves
28. Test on mobile device (responsive design, keyboard behavior)
29. Verify LP optimization still works via solver service
30. Commit changes to main branch

### 8. Success Criteria

✅ All tests pass (frontend + API)
✅ Stats form works smoothly on mobile
✅ Auto-save works on blur
✅ Enter/Tab navigation flows correctly
✅ Gold star toggle behaves as specified
✅ Solver service still handles LP optimization
✅ Screenshot upload/viewing still works
✅ No OCR references in active playthrough UI
✅ Database migration runs successfully
✅ Storybook stories render for all new components

## Future Considerations

**Re-enabling OCR:**
- All database columns preserved (`ocrStatus`, etc.)
- Screenshot images stored and available for batch processing
- OCR code documented in `docs/removed-features/ocr-2025-12-09.md`
- Can re-add PaddleOCR dependencies and endpoints when ready

**Potential Enhancements:**
- Voice input for stats (hands-free entry)
- Predicted values based on historical performance
- Batch edit mode for correcting multiple songs
- Export stats to CSV/JSON for external analysis

## API Changes

**Updated Endpoint:**

```
PATCH /api/playthroughs/:id/songs/:position/stats/:userId
```

**New Request Body Fields:**
```typescript
{
  // ... existing fields ...
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  avgMultiplier?: number;
}
```

**Validation:**
- `difficulty` must be one of the four valid values
- `avgMultiplier` must be a positive decimal (typically 1.0 - 4.0)

## Data Migration Notes

**Backwards Compatibility:**
- New columns are nullable
- Existing stats records remain valid (nulls are acceptable)
- No data transformation needed for migration

**Forward Compatibility:**
- Stats collected moving forward will include difficulty and avgMultiplier
- Historical stats without these fields display as "N/A" in UI

## Environment-Specific Notes

**Yolo Container:**
- Use existing `DATABASE_URL` environment variable (already set in container)
- Do NOT use `.env` file for database connection
- Storybook won't auto-open browser - user must manually navigate to provided URL
- Command to start Storybook: `pnpm --filter @bearded-nemesis/frontend story:dev`
