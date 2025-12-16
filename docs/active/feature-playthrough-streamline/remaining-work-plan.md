---
title: Playthrough Streamline - Remaining Work Plan
type: feature
status: active
created_date: 2025-12-15
---

# Remaining Work Plan: Testing & Documentation

## Status Summary

**Core Implementation: ✅ COMPLETE**
- Database schema updated with difficulty and avgMultiplier
- API endpoints handling new fields with validation
- Frontend components created (NumberInput, StarRatingWithGold, PlaythroughStatsForm)
- OCR removed from UI and solver service
- Basic integration complete

**Testing & Documentation: ❌ INCOMPLETE**
- Component tests only partially written
- No Storybook stories created
- No manual testing verification
- No end-to-end workflow validation

---

## Phase 1: Complete Component Tests

### Task 1: Enhance NumberInput Tests

**File:** `apps/frontend/src/lib/components/NumberInput.test.ts`

**Current State:** Has 3 basic tests (renders, onSave on blur, null for empty)

**Missing Tests (from specs.md):**
1. ❌ Displays suffix correctly (e.g., "%" after completion field)
2. ❌ Uses correct inputmode attribute for mobile keyboards
3. ❌ Respects min and max validation attributes
4. ❌ Disables input while saving (prevents double-submit)
5. ❌ Advances focus on Enter key press
6. ❌ Advances focus on Tab key press

**Implementation Steps:**
```typescript
// Add to NumberInput.test.ts

it('displays suffix correctly', () => {
  render(NumberInput, {
    props: { value: 95, label: 'Completion', suffix: '%', onSave: vi.fn() }
  });
  expect(screen.getByText('%')).toBeInTheDocument();
});

it('uses correct inputmode for mobile keyboards', () => {
  render(NumberInput, {
    props: { value: '', label: 'Multiplier', inputmode: 'decimal', onSave: vi.fn() }
  });
  expect(screen.getByLabelText('Multiplier')).toHaveAttribute('inputmode', 'decimal');
});

it('respects min and max validation', () => {
  render(NumberInput, {
    props: { value: 5, label: 'Stars', min: 1, max: 6, onSave: vi.fn() }
  });
  const input = screen.getByLabelText('Stars');
  expect(input).toHaveAttribute('min', '1');
  expect(input).toHaveAttribute('max', '6');
});

it('disables input while saving', async () => {
  let resolveSave: () => void;
  const mockSave = vi.fn(() => new Promise<void>(resolve => { resolveSave = resolve; }));

  render(NumberInput, {
    props: { value: '', label: 'Score', onSave: mockSave }
  });

  const input = screen.getByLabelText('Score');
  await fireEvent.input(input, { target: { value: '100' } });
  fireEvent.blur(input); // Don't await - check mid-save

  expect(input).toBeDisabled();
  resolveSave!();
});

it('advances focus on Enter key', async () => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const { container } = render(NumberInput, {
    props: { value: '', label: 'Field 1', onSave: mockSave }
  });

  // Create a form with two inputs
  const form = container.querySelector('form');
  // ... (test Enter advances to next input)
});

it('advances focus on Tab key', async () => {
  // Similar to Enter test
});
```

**Verification:** Run `pnpm --filter @bearded-nemesis/frontend test NumberInput`

---

### Task 2: Create StarRatingWithGold Tests

**File:** `apps/frontend/src/lib/components/StarRatingWithGold.test.ts` (CREATE NEW)

**All Tests Needed:**
1. ❌ Renders 5 stars initially
2. ❌ Calls onSelect when star clicked
3. ❌ Shows gold toggle only when 5 stars selected
4. ❌ Applies gold styling when toggle is on
5. ❌ Auto-disables gold when selecting <5 stars
6. ❌ Returns value of 6 when gold is active
7. ❌ Is not interactive when interactive=false

**Implementation:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StarRatingWithGold from './StarRatingWithGold.svelte';

describe('StarRatingWithGold', () => {
  it('renders 5 stars initially', () => {
    render(StarRatingWithGold, { props: { stars: 0, interactive: true } });
    const stars = screen.getAllByText(/[★☆]/);
    expect(stars).toHaveLength(5);
  });

  it('calls onSelect when star is clicked', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: { stars: 0, interactive: true, onSelect: mockSelect }
    });

    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[2]); // Click 3rd star
    expect(mockSelect).toHaveBeenCalledWith(3);
  });

  it('shows gold toggle only when 5 stars selected', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: { stars: 0, interactive: true, onSelect: mockSelect }
    });

    // Gold toggle should not be visible initially
    expect(screen.queryByLabelText('Gold')).not.toBeInTheDocument();

    // Click 5th star
    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[4]);

    // Gold toggle should now be visible
    expect(screen.getByLabelText('Gold')).toBeInTheDocument();
  });

  it('applies gold styling when toggle is on', async () => {
    render(StarRatingWithGold, {
      props: { stars: 6, interactive: true } // Start with gold
    });

    const filledStars = screen.getAllByText('★');
    expect(filledStars[0]).toHaveClass('text-yellow-400'); // Gold color
  });

  it('auto-disables gold when selecting less than 5 stars', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: { stars: 6, interactive: true, onSelect: mockSelect } // Start with gold
    });

    expect(screen.getByLabelText('Gold')).toBeChecked();

    // Click 3rd star
    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[2]);

    expect(mockSelect).toHaveBeenCalledWith(3);
    expect(screen.queryByLabelText('Gold')).not.toBeInTheDocument();
  });

  it('returns value of 6 when gold is active', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: { stars: 5, interactive: true, onSelect: mockSelect }
    });

    const goldCheckbox = screen.getByLabelText('Gold');
    await fireEvent.click(goldCheckbox);

    expect(mockSelect).toHaveBeenCalledWith(6);
  });

  it('is not interactive when interactive=false', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: { stars: 3, interactive: false, onSelect: mockSelect }
    });

    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[4]);

    expect(mockSelect).not.toHaveBeenCalled();
  });
});
```

**Verification:** Run `pnpm --filter @bearded-nemesis/frontend test StarRatingWithGold`

---

### Task 3: Create PlaythroughStatsForm Tests

**File:** `apps/frontend/src/lib/components/PlaythroughStatsForm.test.ts` (CREATE NEW)

**All Tests Needed:**
1. ❌ Renders all 8 fields in correct order
2. ❌ Pre-fills with existing stats
3. ❌ Defaults difficulty to previous song's difficulty
4. ❌ Falls back to playthrough difficulty if no previous song
5. ❌ Calls API to save each field on blur
6. ❌ Handles save errors gracefully
7. ❌ Tab order flows through fields correctly

**Implementation:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PlaythroughStatsForm from './PlaythroughStatsForm.svelte';
import * as playthroughsApi from '$lib/api/playthroughs';

vi.mock('$lib/api/playthroughs');
vi.mock('$lib/stores/toast', () => ({
  toastStore: { error: vi.fn(), success: vi.fn() }
}));

describe('PlaythroughStatsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(playthroughsApi.updateStats).mockResolvedValue(undefined);
  });

  it('renders all 8 fields in correct order', () => {
    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 0,
        currentUserId: 1,
        playerDifficulty: 'expert'
      }
    });

    // Results section
    expect(screen.getByLabelText('Completion')).toBeInTheDocument();
    expect(screen.getByLabelText('Skill Level')).toBeInTheDocument();
    expect(screen.getByLabelText('Score')).toBeInTheDocument();
    expect(screen.getByLabelText('Stars')).toBeInTheDocument();

    // Performance section
    expect(screen.getByLabelText('Longest Streak')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes Hit')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes Missed')).toBeInTheDocument();
    expect(screen.getByLabelText('Avg. Multiplier')).toBeInTheDocument();
  });

  it('pre-fills with existing stats', () => {
    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 0,
        currentUserId: 1,
        playerDifficulty: 'expert',
        existingStats: {
          score: 12345,
          accuracyPct: 95.5,
          starsEarned: 5,
          difficulty: 'hard'
        }
      }
    });

    expect(screen.getByLabelText('Score')).toHaveValue(12345);
    expect(screen.getByLabelText('Completion')).toHaveValue(95.5);
    expect(screen.getByLabelText('Skill Level')).toHaveValue('hard');
  });

  it('defaults difficulty to previous song difficulty', () => {
    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 1,
        currentUserId: 1,
        playerDifficulty: 'medium',
        previousSongDifficulty: 'expert'
      }
    });

    expect(screen.getByLabelText('Skill Level')).toHaveValue('expert');
  });

  it('falls back to playthrough difficulty if no previous song', () => {
    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 0,
        currentUserId: 1,
        playerDifficulty: 'medium'
      }
    });

    expect(screen.getByLabelText('Skill Level')).toHaveValue('medium');
  });

  it('calls API to save each field on blur', async () => {
    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 0,
        currentUserId: 1,
        playerDifficulty: 'expert'
      }
    });

    const scoreInput = screen.getByLabelText('Score');
    await fireEvent.input(scoreInput, { target: { value: '10000' } });
    await fireEvent.blur(scoreInput);

    await waitFor(() => {
      expect(playthroughsApi.updateStats).toHaveBeenCalledWith(
        1, // playthroughId
        0, // position
        1, // userId
        { score: 10000 }
      );
    });
  });

  it('handles save errors gracefully', async () => {
    vi.mocked(playthroughsApi.updateStats).mockRejectedValue(new Error('Network error'));

    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 0,
        currentUserId: 1,
        playerDifficulty: 'expert'
      }
    });

    const scoreInput = screen.getByLabelText('Score');
    await fireEvent.input(scoreInput, { target: { value: '10000' } });
    await fireEvent.blur(scoreInput);

    // Should not throw, should show error toast
    await waitFor(() => {
      expect(playthroughsApi.updateStats).toHaveBeenCalled();
    });
  });
});
```

**Verification:** Run `pnpm --filter @bearded-nemesis/frontend test PlaythroughStatsForm`

---

## Phase 2: Create Storybook Stories

### Task 4: Create NumberInput Stories

**File:** `apps/frontend/src/lib/components/NumberInput.stories.ts` (CREATE NEW)

**Stories Needed:**
1. ❌ Default state (empty)
2. ❌ Pre-filled value
3. ❌ With suffix (percentage example)
4. ❌ With validation (min/max example)
5. ❌ Decimal input (avg multiplier example)

**Implementation:**
```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import NumberInput from './NumberInput.svelte';

const meta = {
  title: 'Components/NumberInput',
  component: NumberInput,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'number' },
    label: { control: 'text' },
    suffix: { control: 'text' },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    inputmode: { control: 'select', options: ['numeric', 'decimal'] }
  }
} satisfies Meta<NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    label: 'Score',
    onSave: async (value) => {
      console.log('Saved:', value);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};

export const WithInitialValue: Story = {
  args: {
    value: 42,
    label: 'Initial Score',
    onSave: async (value) => console.log('Saved:', value)
  }
};

export const WithSuffix: Story = {
  args: {
    value: 95,
    label: 'Completion',
    suffix: '%',
    onSave: async (value) => console.log('Saved:', value)
  }
};

export const WithMinMax: Story = {
  args: {
    value: 3,
    label: 'Stars',
    min: 1,
    max: 6,
    onSave: async (value) => console.log('Saved:', value)
  }
};

export const DecimalInput: Story = {
  args: {
    value: 3.8,
    label: 'Avg Multiplier',
    step: 0.1,
    inputmode: 'decimal',
    onSave: async (value) => console.log('Saved:', value)
  }
};
```

**Verification:**
- Run `pnpm --filter @bearded-nemesis/frontend story:dev`
- Navigate to `http://localhost:6006`
- Check Components/NumberInput in sidebar
- Verify all 5 stories render correctly

---

### Task 5: Create StarRatingWithGold Stories

**File:** `apps/frontend/src/lib/components/StarRatingWithGold.stories.ts` (CREATE NEW)

**Stories Needed:**
1. ❌ No stars (interactive)
2. ❌ Three stars (interactive)
3. ❌ Five stars (interactive, gold toggle available)
4. ❌ Gold stars (6 value)
5. ❌ Display only (non-interactive)

**Implementation:**
```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import StarRatingWithGold from './StarRatingWithGold.svelte';

const meta = {
  title: 'Components/StarRatingWithGold',
  component: StarRatingWithGold,
  tags: ['autodocs'],
  argTypes: {
    stars: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    interactive: { control: 'boolean' }
  }
} satisfies Meta<StarRatingWithGold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoStars: Story = {
  args: {
    stars: 0,
    interactive: true,
    onSelect: (stars) => console.log('Selected:', stars)
  }
};

export const ThreeStars: Story = {
  args: {
    stars: 3,
    interactive: true,
    onSelect: (stars) => console.log('Selected:', stars)
  }
};

export const FiveStars: Story = {
  args: {
    stars: 5,
    interactive: true,
    onSelect: (stars) => console.log('Selected:', stars)
  }
};

export const GoldStars: Story = {
  args: {
    stars: 6,
    interactive: true,
    onSelect: (stars) => console.log('Selected:', stars)
  }
};

export const DisplayOnly: Story = {
  args: {
    stars: 4,
    interactive: false
  }
};
```

**Verification:** Storybook at Components/StarRatingWithGold

---

### Task 6: Create PlaythroughStatsForm Stories

**File:** `apps/frontend/src/lib/components/PlaythroughStatsForm.stories.ts` (CREATE NEW)

**Stories Needed:**
1. ❌ Empty form (new song, no existing stats)
2. ❌ Pre-filled form (editing existing stats)
3. ❌ Different difficulty defaults
4. ❌ Mobile viewport (375px width)

**Implementation:**
```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import PlaythroughStatsForm from './PlaythroughStatsForm.svelte';

const meta = {
  title: 'Components/PlaythroughStatsForm',
  component: PlaythroughStatsForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<PlaythroughStatsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {
  args: {
    playthroughId: 1,
    position: 0,
    currentUserId: 1,
    playerDifficulty: 'expert'
  }
};

export const PreFilledForm: Story = {
  args: {
    playthroughId: 1,
    position: 2,
    currentUserId: 1,
    playerDifficulty: 'expert',
    existingStats: {
      score: 123456,
      accuracyPct: 97.5,
      difficulty: 'expert',
      starsEarned: 6,
      longestStreak: 145,
      notesHit: 523,
      notesMissed: 12,
      avgMultiplier: 3.9
    }
  }
};

export const WithPreviousSongDifficulty: Story = {
  args: {
    playthroughId: 1,
    position: 3,
    currentUserId: 1,
    playerDifficulty: 'medium',
    previousSongDifficulty: 'expert'
  }
};

export const MobileView: Story = {
  args: {
    playthroughId: 1,
    position: 0,
    currentUserId: 1,
    playerDifficulty: 'hard'
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
};
```

**Verification:** Storybook at Components/PlaythroughStatsForm

---

## Phase 3: Manual Testing

### Task 7: Desktop Manual Testing

**Checklist:**
- ❌ Start a playthrough with 3+ songs
- ❌ Rate first song (1-5 stars)
- ❌ Enter stats in form:
  - Completion: 95.5
  - Skill Level: expert
  - Score: 150000
  - Stars: 5 (toggle gold)
  - Longest Streak: 145
  - Notes Hit: 523
  - Notes Missed: 12
  - Avg. Multiplier: 3.9
- ❌ Verify auto-save on each field blur (check Network tab)
- ❌ Press Enter in Completion field → should advance to Skill Level
- ❌ Press Tab in Score field → should advance to Stars
- ❌ Click "Next" to advance to song 2
- ❌ Verify "Skill Level" defaults to "expert" (previous song)
- ❌ Change skill level to "hard" and enter stats
- ❌ Advance to song 3
- ❌ Verify "Skill Level" defaults to "hard"
- ❌ Upload screenshot → verify no OCR indicators appear
- ❌ Finish playthrough
- ❌ View summary → verify all stats are displayed correctly
- ❌ Verify no OCR status/buttons anywhere in UI

---

### Task 8: Mobile Device Testing

**Requirements:**
- Physical mobile device OR browser dev tools mobile emulation
- Network access to dev server

**Setup:**
```bash
# Expose dev server to network
pnpm --filter @bearded-nemesis/frontend dev --host

# Note the network URL (e.g., http://192.168.1.100:5173)
```

**Checklist:**
- ❌ Open app on mobile browser
- ❌ Start playthrough
- ❌ Tap "Completion" field → verify numeric keyboard with decimal
- ❌ Tap "Score" field → verify numeric keyboard (no decimal)
- ❌ Tap "Avg. Multiplier" → verify numeric keyboard with decimal
- ❌ Verify tap targets are at least 44px (easy to tap)
- ❌ Test "Next" button in keyboard → should advance fields
- ❌ Tap stars → verify easy to select specific star
- ❌ Tap gold toggle → verify easy to tap
- ❌ Test screenshot from camera → verify camera option appears
- ❌ Complete full flow on mobile device

---

### Task 9: Multi-Player Testing

**Checklist:**
- ❌ Create playthrough with 2 players (use two browser sessions)
- ❌ Player 1: View page → should see only their own stats form
- ❌ Player 1: Enter stats for song 1
- ❌ Player 2: View page → should see their own empty stats form
- ❌ Player 2: Enter stats for song 1
- ❌ Verify both players' stats saved independently
- ❌ Advance to song 2
- ❌ Verify both players can enter stats independently
- ❌ Finish playthrough
- ❌ View summary → verify both players' stats displayed

---

## Phase 4: Fix Any Issues Found

### Task 10: Address Test Failures

**Process:**
1. Run all tests: `pnpm --filter @bearded-nemesis/frontend test`
2. Identify failures
3. Fix components or tests as needed
4. Re-run tests until all pass

### Task 11: Address Manual Testing Issues

**Process:**
1. Document any bugs found during manual testing
2. Prioritize by severity (blocking vs. nice-to-have)
3. Fix blocking issues
4. Create follow-up tasks for non-blocking issues

---

## Definition of Done

**All Checkboxes Must Be ✅:**

**Tests:**
- ✅ All NumberInput tests passing (9 total)
- ✅ All StarRatingWithGold tests passing (7 total)
- ✅ All PlaythroughStatsForm tests passing (7 total)
- ✅ Frontend test suite: 100% passing
- ✅ API test suite: no regressions (139+ passing)

**Storybook:**
- ✅ NumberInput: 5 stories rendering correctly
- ✅ StarRatingWithGold: 5 stories rendering correctly
- ✅ PlaythroughStatsForm: 4 stories rendering correctly

**Manual Testing:**
- ✅ Desktop flow tested and working
- ✅ Mobile device tested and working
- ✅ Multi-player tested and working
- ✅ No OCR references anywhere in UI
- ✅ Screenshot upload/view still works
- ✅ Stats display correctly in summary

**Documentation:**
- ✅ specs.md updated with all acceptance criteria
- ✅ remaining-work-plan.md completed
- ✅ IMPLEMENTATION_SUMMARY.md updated with final status

---

## Estimated Effort

- **Phase 1 (Component Tests):** 2-3 hours
- **Phase 2 (Storybook Stories):** 1-2 hours
- **Phase 3 (Manual Testing):** 1-2 hours
- **Phase 4 (Fix Issues):** 1-2 hours (depends on findings)

**Total: 5-9 hours**

---

## Next Steps

1. ✅ Specs created (specs.md)
2. ✅ Plan created (this document)
3. ➡️ Start implementing tests (Task 1: Enhance NumberInput tests)
4. Continue with remaining tasks in order
