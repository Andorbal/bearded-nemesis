# Playthrough Completion Screen Enhancement

**Date:** 2025-12-07
**Status:** Design approved

## Problem

The current playthrough completion screen shows only "Playthrough Complete! This playthrough has been finished." Users need to review the session: which songs they played, who rated what, OCR-captured statistics, and any errors requiring correction.

## Solution

Replace the completion message with a comprehensive summary screen showing expandable song cards with ratings, statistics, and editing capability.

## User Interface Design

### Overall Structure

The screen displays three sections:

1. **Header Summary Card** - Overall playthrough statistics
2. **Song List** - Expandable cards for each song
3. **Footer Actions** - Navigation controls

### Header Summary Card

Shows playthrough overview:
- Setlist name
- Total songs played
- Per-player summary: username, instrument, average rating, count of rated songs
- Completion indicators: songs with OCR data, songs with ratings

### Song Cards (Collapsed State)

Each card displays horizontally:
- Album art (48x48px, left)
- Song title (bold) and artist (gray, below title)
- Summary statistics (right):
  - Player count: "3 players rated"
  - Average rating: "Avg: 4.2★"
  - OCR status: ✓ (green), ⚠️ (yellow pending), ✗ (red failed), ○ (gray none)

Cards with incomplete data show a subtle yellow left border.

Click anywhere on the card to expand. A chevron (▼) on the far right rotates when expanded.

### Song Cards (Expanded State)

Expansion reveals three subsections:

**Players & Ratings**
- Grid of player cards
- Each shows: name, instrument badge, difficulty, rating (1-5 stars or "Not rated")

**Performance Statistics** (when OCR data exists)
- Table with columns: Player, Score, Accuracy %, Stars earned (1-6), Longest streak, Notes hit/missed
- Missing data shows "No stats captured"

**Screenshot & OCR**
- Clickable status link: "Screenshot: ✓ View" opens modal with full image
- If no screenshot: "No screenshot uploaded"
- "Re-run OCR" button (when screenshot exists)
- "Edit Stats" button (toggles edit mode)

### Edit Mode

Clicking "Edit Stats" converts the statistics table to editable form inputs:
- Number inputs for score, notes hit/missed, longest streak
- Number input (0-100) for accuracy percentage
- Star selector (1-6) for stars earned
- "Save Changes" (primary) and "Cancel" (secondary) buttons

Save sends PATCH request. Success shows toast and exits edit mode. Error shows toast and keeps edit mode open for retry.

## API Design

### New Endpoints

**GET /playthroughs/:id/summary**

Returns complete playthrough data:

```typescript
{
  playthrough: Playthrough,
  setlist: { id: number, name: string },
  players: PlaythroughPlayerDetails[],
  songs: [
    {
      position: number,
      song: Song,
      screenshotPath: string | null,
      ocrStatus: 'completed' | 'pending' | 'failed' | null,
      ratings: [
        { userId: number, username: string, rating: number }
      ],
      stats: [
        {
          userId: number,
          username: string,
          score: number | null,
          accuracyPct: number | null,
          notesHit: number | null,
          notesMissed: number | null,
          longestStreak: number | null,
          starsEarned: number | null
        }
      ]
    }
  ]
}
```

**PATCH /playthroughs/:id/songs/:position/stats/:userId**

Updates statistics for one player on one song. Accepts:

```typescript
{
  score?: number,
  accuracyPct?: number,  // 0-100
  notesHit?: number,
  notesMissed?: number,
  longestStreak?: number,
  starsEarned?: number    // 1-6
}
```

Validates ranges. Returns updated stats record. Requires user to be a participant.

## Component Structure

**Main page:** `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte`
- Keeps existing active playthrough UI
- Adds completion summary view (when `status === 'finished'`)
- Fetches from `/summary` endpoint

**New components:**

- `PlaythroughSummaryHeader.svelte` - Header card
- `PlaythroughSongCard.svelte` - Collapsible song card with edit logic
- `PlaythroughStatsEditor.svelte` - Form for editing stats
- `ScreenshotModal.svelte` - Full-size screenshot viewer with re-run OCR

## Error Handling

**Missing data:**
- No ratings: show "No ratings submitted"
- No OCR: show "No stats captured"
- Player didn't rate: show "Not rated"

**OCR states:**
- Pending/Processing: spinner icon, "Processing...", disable re-run button
- Failed: error icon, error message, enable re-run button
- None: "No screenshot uploaded", hide OCR buttons

**Failed API calls:**
- Summary fetch fails: error state with retry button
- Stats update fails: toast error, stay in edit mode
- Re-run OCR fails: toast error, keep button enabled

**Partial data:** Display what exists. Visual indicators highlight incomplete songs.

## Testing Strategy

**API tests** (`apps/api/src/routes/playthroughs.test.ts`):
- GET `/playthroughs/:id/summary` returns complete structure
- Summary handles missing stats gracefully
- Summary requires authentication and enforces access control
- PATCH endpoint validates ranges (stars 1-6, accuracy 0-100)
- PATCH requires participant authorization
- PATCH handles non-existent resources

**Repository tests:** New methods for fetching aggregated data, updating stats

**Component tests** (Vitest + Testing Library):
- `PlaythroughSongCard` expands/collapses, renders stats, shows "No stats" when missing
- `PlaythroughStatsEditor` validates input, handles save/cancel
- `PlaythroughSummaryHeader` displays aggregated statistics correctly

**Integration test:** Finish playthrough → load summary → expand song → edit stats → save → verify update

## Implementation Notes

**Performance:** Single consolidated `/summary` endpoint eliminates N API calls (critical for 10-20 song setlists)

**Gold stars:** Validation allows 1-6 stars to support gold star achievement

**Screen space:** No thumbnails. Screenshot access via clickable status indicator only.

**Visual order:** Songs display in play order. Position numbers unnecessary.

**Edit scope:** Each stats editor modifies one player's stats for one song. Multiple players require multiple edit operations.
