---
title: Playthrough Streamline - Feature Specifications
type: feature
status: active
---

# Manual Stats Entry - BDD Specifications

## Feature: Manual Stats Entry During Active Playthrough

As a Rock Band player using the app on my phone
I want to quickly enter my stats after each song
So that I can track my performance without waiting for OCR

### Background
```gherkin
Given I am logged in to the app
And I have started a playthrough with at least 3 songs
And I am playing on "expert" difficulty
```

## Scenario 1: Entering stats for the first song

```gherkin
Given I am on the first song of the playthrough
And I have rated the song 4 stars
When I scroll to the "My Stats" form
Then I should see 8 input fields in this order:
  | Section     | Field            | Type              |
  | Results     | Completion       | Number with "%"   |
  | Results     | Skill Level      | Dropdown          |
  | Results     | Score            | Number            |
  | Results     | Stars            | Star selector     |
  | Performance | Longest Streak   | Number            |
  | Performance | Notes Hit        | Number            |
  | Performance | Notes Missed     | Number            |
  | Performance | Avg. Multiplier  | Decimal number    |

And the "Skill Level" dropdown should default to "expert"
And all other fields should be empty
```

## Scenario 2: Auto-save behavior

```gherkin
Given I am on the "My Stats" form
When I enter "95.5" in the "Completion" field
And I move focus to the next field (tab or tap)
Then the completion percentage should be saved immediately
And I should see no error messages
And the field should remain editable

When I enter "150000" in the "Score" field
And I tap outside the field
Then the score should be saved immediately
And I should see no error messages
```

## Scenario 3: Star rating with gold stars

```gherkin
Given I am on the "My Stats" form
And the "Stars" field shows 0 stars

When I tap the 5th star
Then all 5 stars should be filled in yellow
And a "Gold" toggle should appear next to the stars
And the value saved should be 5

When I enable the "Gold" toggle
Then all 5 stars should turn gold (darker yellow)
And the value saved should be 6

When I tap the 3rd star
Then only 3 stars should be filled
And the "Gold" toggle should disappear
And the value saved should be 3
```

## Scenario 4: Field navigation with Enter key

```gherkin
Given I am on the "My Stats" form
And I am focused on the "Completion" field

When I type "95" and press Enter
Then the value should be saved
And focus should move to the "Skill Level" dropdown

When I select "hard" and press Tab
Then the value should be saved
And focus should move to the "Score" field

When I type "120000" and press Enter
Then the value should be saved
And focus should move to the "Stars" field
```

## Scenario 5: Mobile numeric keyboard behavior

```gherkin
Given I am on a mobile device
And I am on the "My Stats" form

When I tap the "Completion" field
Then the mobile numeric keyboard should appear
And the keyboard should show decimal point option

When I tap the "Score" field
Then the mobile numeric keyboard should appear
And the keyboard should show only digits (no decimal)

When I tap the "Avg. Multiplier" field
Then the mobile numeric keyboard should appear
And the keyboard should show decimal point option
```

## Scenario 6: Difficulty defaults to previous song

```gherkin
Given I completed the first song with "expert" difficulty
And I entered stats for the first song
When I advance to the second song
And I view the "My Stats" form
Then the "Skill Level" should default to "expert"

When I change the skill level to "hard"
And I save the stats
And I advance to the third song
Then the "Skill Level" should default to "hard"
```

## Scenario 7: Pre-filled stats (editing existing stats)

```gherkin
Given I previously entered stats for the current song:
  | Field            | Value  |
  | Completion       | 95.5   |
  | Skill Level      | expert |
  | Score            | 150000 |
  | Stars            | 6      |
  | Longest Streak   | 145    |
  | Notes Hit        | 523    |
  | Notes Missed     | 12     |
  | Avg. Multiplier  | 3.9    |

When I view the "My Stats" form
Then all fields should be pre-filled with the saved values
And the "Skill Level" should show "expert"
And the star selector should show 5 gold stars
And the "Gold" toggle should be enabled
```

## Scenario 8: Empty values save as null

```gherkin
Given I have entered "150000" in the "Score" field
And the score has been saved

When I clear the "Score" field (make it empty)
And I move focus to another field
Then the score should be saved as null
And the field should remain empty
And no error should be shown
```

## Scenario 9: Error handling for failed saves

```gherkin
Given the API server is temporarily unavailable
And I am on the "My Stats" form

When I enter "95" in the "Completion" field
And I move focus to the next field
Then I should see an error toast message
And the field should remain editable
And the value should not be lost
```

## Scenario 10: Screenshot upload still works (no OCR)

```gherkin
Given I am on an active playthrough song
And I have entered my stats

When I tap "Take/Upload Screenshot"
And I select a photo from my camera roll
Then I should see "Screenshot uploaded" confirmation
And I should NOT see any OCR processing indicators
And I should NOT see OCR status (pending/completed/failed)
And the screenshot should be saved for future viewing
```

## Scenario 11: Viewing saved stats in playthrough summary

```gherkin
Given I have completed a playthrough
And I entered stats for 3 songs with varying difficulties

When I view the playthrough summary
Then for each song I should see:
  - The difficulty I played on
  - My score
  - Stars earned (with gold indicator if applicable)
  - Completion percentage
  - Notes hit/missed
  - Longest streak
  - Average multiplier

And I should NOT see any OCR-related information
And I should be able to view uploaded screenshots
```

## Scenario 12: Multi-player scenario (each player enters their own stats)

```gherkin
Given I am in a 2-player playthrough
And both players are on "expert" difficulty
And we just finished a song

When Player 1 views the playthrough page
Then Player 1 should see only their own "My Stats" form
And Player 1 should NOT see Player 2's stats form

When Player 1 enters their stats
And Player 2 views the playthrough page
Then Player 2 should see their own empty "My Stats" form
And Player 2 should be able to enter their stats independently

When both players finish entering stats
And we advance to the next song
Then both players' stats should be saved
And both players should see the summary showing both sets of stats
```

---

## Technical Acceptance Criteria

### Component Tests (Vitest)

**NumberInput.svelte:**
- ✅ Renders with label and initial value
- ✅ Calls onSave when field loses focus
- ✅ Calls onSave with null for empty value
- ❌ Displays suffix correctly
- ❌ Uses correct inputmode for mobile keyboards
- ❌ Respects min and max validation
- ❌ Disables input while saving
- ❌ Advances focus on Enter key
- ❌ Advances focus on Tab key

**StarRatingWithGold.svelte:**
- ❌ Renders 5 stars initially
- ❌ Calls onSelect when star clicked
- ❌ Shows gold toggle only when 5 stars selected
- ❌ Applies gold styling when toggle is on
- ❌ Auto-disables gold when selecting <5 stars
- ❌ Returns value of 6 when gold is active
- ❌ Is not interactive when interactive=false

**PlaythroughStatsForm.svelte:**
- ❌ Renders all 8 fields in correct order
- ❌ Pre-fills with existing stats
- ❌ Defaults difficulty to previous song's difficulty
- ❌ Falls back to playthrough difficulty if no previous song
- ❌ Calls API to save each field on blur
- ❌ Handles save errors gracefully
- ❌ Tab order flows through fields correctly

### Storybook Stories

**NumberInput.stories.ts:**
- ❌ Default state (empty)
- ❌ Pre-filled value
- ❌ With suffix (percentage example)
- ❌ With validation (min/max example)
- ❌ Decimal input (avg multiplier example)

**StarRatingWithGold.stories.ts:**
- ❌ Interactive mode (all states 0-5, gold on/off)
- ❌ Display mode (non-interactive)
- ❌ Various star counts with/without gold

**PlaythroughStatsForm.stories.ts:**
- ❌ Empty form (new song, no existing stats)
- ❌ Pre-filled form (editing existing stats)
- ❌ Different difficulty defaults (playthrough vs previous song)
- ❌ Mobile viewport (375px width)

### Manual Testing Checklist

**Desktop Testing:**
- ❌ Complete flow: start playthrough → enter stats → advance → verify saves
- ❌ Enter/Tab navigation flows correctly through all fields
- ❌ Auto-save works on blur for each field
- ❌ Gold star toggle behaves as specified
- ❌ Error handling shows appropriate messages

**Mobile Testing (Physical Device):**
- ❌ Form is easily tappable (44px minimum tap targets)
- ❌ Numeric keyboard appears for number fields
- ❌ Decimal keyboard appears for decimal fields
- ❌ "Next" button in keyboard advances to next field
- ❌ Star selector is easy to tap
- ❌ Gold toggle is accessible
- ❌ Screenshot upload works from camera

**Integration Testing:**
- ❌ Multi-player: each player sees only their own form
- ❌ Difficulty defaults correctly based on previous song
- ❌ Stats display correctly in playthrough summary
- ❌ No OCR indicators anywhere in UI
- ❌ Screenshot upload/view still works

---

## Legend
- ✅ Complete
- ❌ Not yet implemented
- ⚠️ Partially complete or has issues
