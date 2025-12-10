# Playthrough Streamline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove OCR from active playthrough workflow and implement mobile-optimized manual stats entry with auto-save.

**Architecture:** Remove PaddleOCR from solver service while preserving LP optimization. Add `difficulty` and `avgMultiplier` columns to stats table. Build atomic Svelte components (NumberInput, StarRatingWithGold) that compose into PlaythroughStatsForm. Auto-save on blur, Enter/Tab navigation for rapid mobile entry.

**Tech Stack:** Svelte 5, TypeScript, PostgreSQL, FastAPI (Python), Storybook, Vitest

**Environment Notes:**
- Running in yolo container - use existing `DATABASE_URL` environment variable
- Storybook won't auto-open browser - will need manual start and navigation
- Working directly on main branch per project conventions

---

## Phase 1: Documentation & OCR Cleanup

### Task 1: Document OCR Removal

**Files:**
- Create: `docs/removed-features/ocr-2025-12-09.md`

**Step 1: Get current commit SHA**

Run: `git rev-parse HEAD`
Expected: A commit hash (e.g., `413cda9...`)

**Step 2: Create documentation file**

```markdown
# OCR Feature Removal - December 9, 2025

## Why Removed

OCR processing has been a bottleneck preventing the app from being immediately useful. By removing it from the active workflow, we can:
- Make the app usable now with manual stats entry
- Still collect screenshot images for future batch processing
- Preserve all OCR infrastructure for later re-enablement

## Last Working Version

**Commit:** `[PASTE_COMMIT_SHA_HERE]`
**Date:** 2025-12-09

## What Was Removed

### From Solver Service (`apps/solver/`)
- PaddleOCR dependencies from `requirements.txt` (lines 11-12)
- PaddleOCR model downloads from `Dockerfile` (lines 18-26, 29-31)
- OCR endpoints from `app/main.py` (lines 8-9, 13-136)
- Background task processing for OCR
- In-memory OCR job store

### From Frontend
- OCR status indicators in active playthrough UI
- "Re-run OCR" button from ScreenshotModal
- OCR WebSocket event handlers

## What Was Preserved

### Database
- All OCR-related columns in `playthrough_songs` table:
  - `screenshot_path`
  - `ocr_status`
  - `ocr_error`
  - `ocr_processed_at`

### Solver Service
- LP optimization functionality (still works)
- `/solve` endpoint
- HiGHS solver dependencies

### OCR Code Location
- Complete OCR implementation preserved in `apps/solver/app/ocr/`
- Files: `__init__.py`, `models.py`, `paddle_extraction.py`, `preprocessing.py`, `regions.py`, `stars.py`
- Tests preserved in `ocr/test_*.py` files

### Frontend
- Screenshot upload functionality
- Screenshot viewing in playthrough summary
- Image storage infrastructure

## How to Re-Enable OCR

1. Restore PaddleOCR dependencies to `apps/solver/requirements.txt`:
   ```
   paddlepaddle>=2.6.0,<3.0.0
   paddleocr>=2.8.0,<2.9.0
   ```

2. Restore model downloads to `apps/solver/Dockerfile` (see commit above)

3. Restore OCR endpoints to `apps/solver/app/main.py`:
   - Import `extract_stats` from `app.ocr`
   - Import OCR models
   - Add POST `/ocr` endpoint
   - Add GET `/ocr/{job_id}` endpoint
   - Add `ocr_jobs` dictionary and `process_ocr_job` function

4. Restore frontend OCR UI:
   - Re-add OCR status indicators to PlaythroughSongCard
   - Re-add "Re-run OCR" button to ScreenshotModal
   - Re-add WebSocket OCR event handlers

5. Rebuild and redeploy solver service

## Testing OCR Re-enablement

1. Upload a screenshot during playthrough
2. Verify `/ocr` endpoint is called
3. Check OCR job status via `/ocr/{job_id}`
4. Verify stats are extracted and saved
5. Confirm WebSocket broadcasts OCR completion
```

**Step 3: Commit documentation**

Run:
```bash
export GIT_AUTHOR_NAME="Claude" && \
export GIT_AUTHOR_EMAIL="noreply@anthropic.com" && \
git add docs/removed-features/ocr-2025-12-09.md && \
git commit -m "docs: document OCR removal for future re-enablement"
```

Expected: Commit created successfully

---

### Task 2: Remove PaddleOCR from Solver Requirements

**Files:**
- Modify: `apps/solver/requirements.txt:11-12`

**Step 1: Remove PaddleOCR dependencies**

Edit `apps/solver/requirements.txt` and remove lines 11-12:
```diff
- paddlepaddle>=2.6.0,<3.0.0
- paddleocr>=2.8.0,<2.9.0
```

File should now end at line 10 with `pytest>=7.4.4`

**Step 2: Commit changes**

Run:
```bash
git add apps/solver/requirements.txt && \
git commit -m "refactor(solver): remove PaddleOCR dependencies"
```

Expected: Commit created successfully

---

### Task 3: Remove PaddleOCR from Solver Dockerfile

**Files:**
- Modify: `apps/solver/Dockerfile:18-31`

**Step 1: Remove model download and environment setup**

Edit `apps/solver/Dockerfile` and remove lines 18-31:

```diff
- # Download PaddleOCR models to avoid runtime download
- RUN mkdir -p /opt/paddleocr-models && \
-     curl -L -o /tmp/en_PP-OCRv3_det_infer.tar https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_det_infer.tar && \
-     tar -xf /tmp/en_PP-OCRv3_det_infer.tar -C /opt/paddleocr-models/ && \
-     curl -L -o /tmp/en_PP-OCRv3_rec_infer.tar https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_rec_infer.tar && \
-     tar -xf /tmp/en_PP-OCRv3_rec_infer.tar -C /opt/paddleocr-models/ && \
-     curl -L -o /tmp/ch_ppocr_mobile_v2.0_cls_infer.tar https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar && \
-     tar -xf /tmp/ch_ppocr_mobile_v2.0_cls_infer.tar -C /opt/paddleocr-models/ && \
-     rm -rf /tmp/*.tar
-
- # Set PaddleOCR model paths
- ENV PADDLEOCR_DET_MODEL_DIR=/opt/paddleocr-models/en_PP-OCRv3_det_infer
- ENV PADDLEOCR_REC_MODEL_DIR=/opt/paddleocr-models/en_PP-OCRv3_rec_infer
- ENV PADDLEOCR_CLS_MODEL_DIR=/opt/paddleocr-models/ch_ppocr_mobile_v2.0_cls_infer
```

**Step 2: Commit changes**

Run:
```bash
git add apps/solver/Dockerfile && \
git commit -m "refactor(solver): remove PaddleOCR model downloads from Dockerfile"
```

Expected: Commit created successfully

---

### Task 4: Remove OCR Endpoints from Solver Service

**Files:**
- Modify: `apps/solver/app/main.py:8-9,13-136`

**Step 1: Remove OCR imports**

Edit `apps/solver/app/main.py` and remove lines 8-9:

```diff
  from app.models import SolveRequest, SolveResponse
  from app.solver import solve_setlist
- from app.ocr import extract_stats
- from app.ocr.models import OcrRequest, OcrResult, OcrJobStatus
```

**Step 2: Remove OCR job store and endpoints**

Remove lines 13-136 (everything between the app declaration and `/health` endpoint):

```diff
- # In-memory job store for OCR tasks
- # Note: For multi-worker deployments, use Redis or database instead
- ocr_jobs: Dict[str, dict] = {}
-
-
- def process_ocr_job(job_id: str):
-     """Background task to process OCR job."""
-     ...
-
-
  @app.get("/health")
  async def health():
      return {"status": "ok"}
-
-
- @app.post("/ocr")
- async def submit_ocr(request: OcrRequest, background_tasks: BackgroundTasks):
-     ...
-
-
- @app.get("/ocr/{job_id}", response_model=OcrJobStatus)
- async def get_ocr_result(job_id: str):
-     ...
```

**Step 3: Remove unused imports**

Remove `BackgroundTasks` and `Dict` imports since they're no longer needed:

```diff
- from fastapi import FastAPI, HTTPException, BackgroundTasks
+ from fastapi import FastAPI, HTTPException
- from typing import Dict
- from uuid import uuid4
- from datetime import datetime
```

After cleanup, `apps/solver/app/main.py` should contain:
```python
from fastapi import FastAPI, HTTPException

from app.models import SolveRequest, SolveResponse
from app.solver import solve_setlist

app = FastAPI(title="Bearded Nemesis Solver")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
async def solve(request: SolveRequest) -> SolveResponse:
    """
    Solve for optimal setlist using Linear Programming.

    Takes candidate songs with ratings and constraints, returns
    ordered list of song IDs that maximize the objective function
    while satisfying all constraints.
    """
    try:
        result = solve_setlist(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")
```

**Step 4: Commit changes**

Run:
```bash
git add apps/solver/app/main.py && \
git commit -m "refactor(solver): remove OCR endpoints, keep LP optimization"
```

Expected: Commit created successfully

---

### Task 5: Rebuild and Verify Solver Service

**Files:**
- N/A (Docker operation)

**Step 1: Stop existing solver container**

Run: `docker-compose stop solver`
Expected: Container stopped

**Step 2: Rebuild solver image**

Run: `docker-compose build solver`
Expected: Build completes successfully (much faster without PaddleOCR downloads)

**Step 3: Start solver container**

Run: `docker-compose up -d solver`
Expected: Container starts successfully

**Step 4: Verify LP endpoint still works**

Run:
```bash
curl -X POST http://localhost:8081/solve \
  -H "Content-Type: application/json" \
  -d '{
    "songs": [{"songId": 1, "value": 5.0}],
    "constraints": {"songCountMin": 1, "songCountMax": 1}
  }'
```

Expected: JSON response with `"selectedSongIds": [1]`

**Step 5: Verify OCR endpoints are gone**

Run: `curl -X POST http://localhost:8081/ocr -H "Content-Type: application/json" -d '{"image_path": "/test.jpg"}'`
Expected: 404 Not Found

**Step 6: Commit verification note**

Run:
```bash
git commit --allow-empty -m "verify: solver service LP optimization still works without OCR"
```

Expected: Empty commit created

---

## Phase 2: Database Schema & Types

### Task 6: Create Migration File

**Files:**
- Create: `apps/api/src/db/migrations/005_add_stats_difficulty_and_multiplier.sql`

**Step 1: Create migration file**

```sql
-- Add difficulty and avg_multiplier to playthrough song stats
-- Difficulty allows per-song skill level changes (Rock Band 4 feature)
-- Avg multiplier was missing from original schema

ALTER TABLE playthrough_song_stats
  ADD COLUMN difficulty VARCHAR(10),  -- 'easy', 'medium', 'hard', 'expert'
  ADD COLUMN avg_multiplier DECIMAL(4,1);  -- e.g., 3.8

-- No default values - these are nullable for backwards compatibility
-- Existing stats remain valid with NULL values
```

**Step 2: Commit migration**

Run:
```bash
git add apps/api/src/db/migrations/005_add_stats_difficulty_and_multiplier.sql && \
git commit -m "migration: add difficulty and avg_multiplier to playthrough_song_stats"
```

Expected: Commit created successfully

---

### Task 7: Run Migration

**Files:**
- N/A (Database operation)

**Step 1: Run migration using existing DATABASE_URL**

**IMPORTANT:** Use the DATABASE_URL environment variable already set in the container, NOT the .env file.

Run:
```bash
cd apps/api && \
pnpm db:migrate
```

Expected:
```
Running migrations...
Applying migration: 005_add_stats_difficulty_and_multiplier.sql
Migration complete
```

**Step 2: Verify columns were added**

Run (from apps/api directory):
```bash
node -e "
const { query } = require('./dist/db/pool.js');
query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \\'playthrough_song_stats\\' AND column_name IN (\\'difficulty\\', \\'avg_multiplier\\')').then(r => console.log(r));
"
```

Expected: Two rows showing `difficulty` (character varying) and `avg_multiplier` (numeric)

**Step 3: Commit verification**

Run:
```bash
git commit --allow-empty -m "verify: migration 005 applied successfully"
```

Expected: Empty commit created

---

### Task 8: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts:160-172`

**Step 1: Add new fields to PlaythroughSongStats interface**

Edit `packages/shared/src/types.ts` at line 160:

```diff
  export interface PlaythroughSongStats {
    id: number;
    playthroughSongId: number;
    userId: number;
    score: number | null;
    notesHit: number | null;
    notesMissed: number | null;
    longestStreak: number | null;
    starsEarned: number | null; // game's 1-5 (or 6 for gold)
    accuracyPct: number | null;
+   difficulty: Difficulty | null;
+   avgMultiplier: number | null;
    rating: number | null; // user's enjoyment 1-5
    createdAt: Date;
  }
```

**Step 2: Rebuild shared package**

Run:
```bash
pnpm --filter @bearded-nemesis/shared build
```

Expected: Build succeeds, types are generated

**Step 3: Commit changes**

Run:
```bash
git add packages/shared/src/types.ts && \
git commit -m "feat(shared): add difficulty and avgMultiplier to PlaythroughSongStats"
```

Expected: Commit created successfully

---

### Task 9: Update Stats Repository - Interfaces

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts:4-24,26-38`

**Step 1: Add fields to CreateStatsData interface**

Edit around line 4:

```diff
  interface CreateStatsData {
    playthroughSongId: number;
    userId: number;
    score?: number | null;
    notesHit?: number | null;
    notesMissed?: number | null;
    longestStreak?: number | null;
    starsEarned?: number | null;
    accuracyPct?: number | null;
+   difficulty?: string | null;
+   avgMultiplier?: number | null;
    rating?: number | null;
  }
```

**Step 2: Add fields to UpdateStatsData interface**

Edit around line 16:

```diff
  interface UpdateStatsData {
    score?: number | null;
    notesHit?: number | null;
    notesMissed?: number | null;
    longestStreak?: number | null;
    starsEarned?: number | null;
    accuracyPct?: number | null;
+   difficulty?: string | null;
+   avgMultiplier?: number | null;
    rating?: number | null;
  }
```

**Step 3: Add fields to DbPlaythroughSongStats interface**

Edit around line 26:

```diff
  interface DbPlaythroughSongStats {
    id: number;
    playthrough_song_id: number;
    user_id: number;
    score: number | null;
    notes_hit: number | null;
    notes_missed: number | null;
    longest_streak: number | null;
    stars_earned: number | null;
    accuracy_pct: string | null;
+   difficulty: string | null;
+   avg_multiplier: string | null;
    rating: number | null;
    created_at: Date;
  }
```

**Step 4: Commit interface updates**

Run:
```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts && \
git commit -m "refactor(api): update stats repository interfaces for new fields"
```

Expected: Commit created successfully

---

### Task 10: Update Stats Repository - Mapping Function

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts:40-54`

**Step 1: Update mapToStats function**

Edit around line 40:

```diff
  function mapToStats(row: DbPlaythroughSongStats): PlaythroughSongStats {
    return {
      id: row.id,
      playthroughSongId: row.playthrough_song_id,
      userId: row.user_id,
      score: row.score,
      notesHit: row.notes_hit,
      notesMissed: row.notes_missed,
      longestStreak: row.longest_streak,
      starsEarned: row.stars_earned,
      accuracyPct: row.accuracy_pct ? parseFloat(row.accuracy_pct) : null,
+     difficulty: row.difficulty as Difficulty | null,
+     avgMultiplier: row.avg_multiplier ? parseFloat(row.avg_multiplier) : null,
      rating: row.rating,
      createdAt: row.created_at,
    };
  }
```

**Step 2: Add Difficulty import**

At top of file, update imports:

```diff
  import { query, queryOne } from '../db/pool.js';
- import type { PlaythroughSongStats } from '@bearded-nemesis/shared';
+ import type { PlaythroughSongStats, Difficulty } from '@bearded-nemesis/shared';
```

**Step 3: Commit mapping updates**

Run:
```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts && \
git commit -m "refactor(api): update stats mapping to include difficulty and avgMultiplier"
```

Expected: Commit created successfully

---

### Task 11: Update Stats Repository - Create Function

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts:56-76`

**Step 1: Update INSERT query to include new columns**

Edit around line 56:

```diff
  export async function create(data: CreateStatsData): Promise<PlaythroughSongStats> {
    const row = await queryOne<DbPlaythroughSongStats>(
      `INSERT INTO playthrough_song_stats
       (playthrough_song_id, user_id, score, notes_hit, notes_missed, longest_streak,
-       stars_earned, accuracy_pct, rating)
-      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
+       stars_earned, accuracy_pct, difficulty, avg_multiplier, rating)
+      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.playthroughSongId,
        data.userId,
        data.score ?? null,
        data.notesHit ?? null,
        data.notesMissed ?? null,
        data.longestStreak ?? null,
        data.starsEarned ?? null,
        data.accuracyPct ?? null,
+       data.difficulty ?? null,
+       data.avgMultiplier ?? null,
        data.rating ?? null,
      ]
    );
    return mapToStats(row!);
  }
```

**Step 2: Commit create function update**

Run:
```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts && \
git commit -m "refactor(api): support difficulty and avgMultiplier in create stats"
```

Expected: Commit created successfully

---

### Task 12: Update Stats Repository - Update Function

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts:102-149`

**Step 1: Add difficulty handling to update function**

Edit around line 136 (after accuracyPct check):

```diff
    if (data.accuracyPct !== undefined) {
      sets.push(`accuracy_pct = $${paramIndex++}`);
      values.push(data.accuracyPct);
    }
+   if (data.difficulty !== undefined) {
+     sets.push(`difficulty = $${paramIndex++}`);
+     values.push(data.difficulty);
+   }
+   if (data.avgMultiplier !== undefined) {
+     sets.push(`avg_multiplier = $${paramIndex++}`);
+     values.push(data.avgMultiplier);
+   }
    if (data.rating !== undefined) {
      sets.push(`rating = $${paramIndex++}`);
      values.push(data.rating);
    }
```

**Step 2: Commit update function changes**

Run:
```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts && \
git commit -m "refactor(api): support difficulty and avgMultiplier in update stats"
```

Expected: Commit created successfully

---

### Task 13: Update Stats Repository - Join Queries

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts:159-177,186-205`

**Step 1: Add fields to DbStatsWithUsername interface**

Edit around line 159:

```diff
  interface DbStatsWithUsername {
    username: string;
+   user_id: number;
    score: number | null;
    accuracy_pct: string | null;
    notes_hit: number | null;
    notes_missed: number | null;
    longest_streak: number | null;
    stars_earned: number | null;
+   difficulty: string | null;
+   avg_multiplier: string | null;
  }
```

**Step 2: Add fields to StatsWithUsername interface**

Edit around line 169:

```diff
  export interface StatsWithUsername {
    username: string;
+   userId: number;
    score: number | null;
    accuracyPct: number | null;
    notesHit: number | null;
    notesMissed: number | null;
    longestStreak: number | null;
    starsEarned: number | null;
+   difficulty: string | null;
+   avgMultiplier: number | null;
  }
```

**Step 3: Update query to select new fields**

Edit around line 186:

```diff
  export async function getStatsWithUsernamesForPlaythroughSong(
    playthroughSongId: number
  ): Promise<StatsWithUsername[]> {
    const rows = await query<DbStatsWithUsername>(
-     `SELECT u.username, s.score, s.accuracy_pct, s.notes_hit, s.notes_missed,
-             s.longest_streak, s.stars_earned
+     `SELECT u.username, s.user_id, s.score, s.accuracy_pct, s.notes_hit, s.notes_missed,
+             s.longest_streak, s.stars_earned, s.difficulty, s.avg_multiplier
       FROM playthrough_song_stats s
       JOIN users u ON s.user_id = u.id
       WHERE s.playthrough_song_id = $1
       ORDER BY s.created_at`,
      [playthroughSongId]
    );

    return rows.map(row => ({
      username: row.username,
+     userId: row.user_id,
      score: row.score,
      accuracyPct: row.accuracy_pct ? parseFloat(row.accuracy_pct) : null,
      notesHit: row.notes_hit,
      notesMissed: row.notes_missed,
      longestStreak: row.longest_streak,
      starsEarned: row.stars_earned,
+     difficulty: row.difficulty,
+     avgMultiplier: row.avg_multiplier ? parseFloat(row.avg_multiplier) : null,
    }));
  }
```

**Step 4: Commit join query updates**

Run:
```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts && \
git commit -m "refactor(api): include difficulty and avgMultiplier in stats join queries"
```

Expected: Commit created successfully

---

### Task 14: Test Repository Changes

**Files:**
- N/A (Test execution)

**Step 1: Run API tests**

Run:
```bash
cd apps/api && \
pnpm test playthroughSongStatsRepository
```

Expected: All tests pass (existing tests should still work with nullable fields)

**Step 2: If tests fail, check for type errors**

Common issues:
- Missing Difficulty import
- Incorrect decimal parsing for avg_multiplier
- Missing fields in map functions

**Step 3: Commit test verification**

Run:
```bash
git commit --allow-empty -m "test: verify stats repository handles new fields correctly"
```

Expected: Empty commit created

---

## Phase 3: Atomic Components + Storybook

### Task 15: Create NumberInput Component - File Setup

**Files:**
- Create: `apps/frontend/src/lib/components/NumberInput.svelte`
- Create: `apps/frontend/src/lib/components/NumberInput.test.ts`
- Create: `apps/frontend/src/lib/components/NumberInput.stories.ts`

**Step 1: Create component file with props interface**

Create `apps/frontend/src/lib/components/NumberInput.svelte`:

```svelte
<script lang="ts">
  interface Props {
    value: number | string;
    label: string;
    suffix?: string;
    min?: number;
    max?: number;
    step?: number;
    inputmode?: 'numeric' | 'decimal';
    onSave: (value: number | null) => Promise<void>;
  }

  let {
    value = '',
    label,
    suffix,
    min,
    max,
    step = 1,
    inputmode = 'numeric',
    onSave
  }: Props = $props();

  let currentValue = $state(value);
  let inputRef: HTMLInputElement;
  let saving = $state(false);

  // Sync with external value changes
  $effect(() => {
    currentValue = value;
  });

  async function handleBlur() {
    if (saving) return;

    saving = true;
    try {
      const numValue = currentValue === '' ? null : Number(currentValue);
      await onSave(numValue);
    } finally {
      saving = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Find next input in the form
      const form = inputRef.closest('form');
      if (!form) return;

      const inputs = Array.from(form.querySelectorAll('input, select'));
      const currentIndex = inputs.indexOf(inputRef);
      const nextInput = inputs[currentIndex + 1] as HTMLInputElement | HTMLSelectElement;

      if (nextInput && e.key === 'Enter') {
        e.preventDefault();
        nextInput.focus();
      }
    }
  }
</script>

<div class="mb-3">
  <label class="block text-xs font-medium text-gray-700 mb-1">
    {label}
  </label>
  <div class="relative">
    <input
      bind:this={inputRef}
      type="number"
      bind:value={currentValue}
      onblur={handleBlur}
      onkeydown={handleKeyDown}
      {min}
      {max}
      {step}
      {inputmode}
      disabled={saving}
      class="input w-full"
      class:opacity-50={saving}
    />
    {#if suffix}
      <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
        {suffix}
      </span>
    {/if}
  </div>
</div>
```

**Step 2: Commit component skeleton**

Run:
```bash
git add apps/frontend/src/lib/components/NumberInput.svelte && \
git commit -m "feat(frontend): create NumberInput component with auto-save and navigation"
```

Expected: Commit created successfully

---

### Task 16: Write NumberInput Tests

**Files:**
- Create: `apps/frontend/src/lib/components/NumberInput.test.ts`

**Step 1: Write test file**

Create `apps/frontend/src/lib/components/NumberInput.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NumberInput from './NumberInput.svelte';

describe('NumberInput', () => {
  it('renders with label and initial value', () => {
    const mockSave = vi.fn();
    render(NumberInput, {
      props: {
        value: 42,
        label: 'Test Input',
        onSave: mockSave
      }
    });

    expect(screen.getByLabelText('Test Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Test Input')).toHaveValue(42);
  });

  it('calls onSave when field loses focus', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    render(NumberInput, {
      props: {
        value: '',
        label: 'Score',
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Score');
    await fireEvent.input(input, { target: { value: '150' } });
    await fireEvent.blur(input);

    expect(mockSave).toHaveBeenCalledWith(150);
  });

  it('calls onSave with null for empty value', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    render(NumberInput, {
      props: {
        value: 42,
        label: 'Score',
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Score');
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.blur(input);

    expect(mockSave).toHaveBeenCalledWith(null);
  });

  it('displays suffix correctly', () => {
    const mockSave = vi.fn();
    render(NumberInput, {
      props: {
        value: 95,
        label: 'Completion',
        suffix: '%',
        onSave: mockSave
      }
    });

    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('uses correct inputmode for mobile keyboards', () => {
    const mockSave = vi.fn();
    render(NumberInput, {
      props: {
        value: 3.8,
        label: 'Multiplier',
        inputmode: 'decimal',
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Multiplier');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('respects min and max validation', () => {
    const mockSave = vi.fn();
    render(NumberInput, {
      props: {
        value: 5,
        label: 'Stars',
        min: 1,
        max: 6,
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Stars');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '6');
  });

  it('disables input while saving', async () => {
    let resolveSave: () => void;
    const mockSave = vi.fn(() => new Promise<void>(resolve => {
      resolveSave = resolve;
    }));

    render(NumberInput, {
      props: {
        value: '',
        label: 'Score',
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Score');
    await fireEvent.input(input, { target: { value: '100' } });
    fireEvent.blur(input); // Don't await - we want to check mid-save

    expect(input).toBeDisabled();

    resolveSave!();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/frontend && \
pnpm test NumberInput
```

Expected: Tests fail (component needs adjustments)

**Step 3: Commit test file**

Run:
```bash
git add apps/frontend/src/lib/components/NumberInput.test.ts && \
git commit -m "test(frontend): add NumberInput component tests"
```

Expected: Commit created successfully

---

### Task 17: Fix NumberInput to Pass Tests

**Files:**
- Modify: `apps/frontend/src/lib/components/NumberInput.svelte`

**Step 1: Run tests and fix issues one by one**

Run: `cd apps/frontend && pnpm test NumberInput --watch`

**Step 2: Likely needed fixes:**
- Ensure proper two-way binding
- Fix blur handler async behavior
- Ensure disabled state during save

**Step 3: Once all tests pass, commit fixes**

Run:
```bash
git add apps/frontend/src/lib/components/NumberInput.svelte && \
git commit -m "fix(frontend): NumberInput passes all tests"
```

Expected: Commit created, all NumberInput tests passing

---

### Task 18: Create NumberInput Storybook Stories

**Files:**
- Create: `apps/frontend/src/lib/components/NumberInput.stories.ts`

**Step 1: Create stories file**

Create `apps/frontend/src/lib/components/NumberInput.stories.ts`:

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
    inputmode: {
      control: 'select',
      options: ['numeric', 'decimal']
    }
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

**Step 2: User must manually start Storybook**

**IMPORTANT:** In yolo container, Storybook won't auto-open browser.

Tell user to run:
```bash
pnpm --filter @bearded-nemesis/frontend story:dev
```

Then navigate to `http://localhost:6006` in their browser.

**Step 3: Verify NumberInput stories render**

User should see:
- Components/NumberInput in the sidebar
- All 5 stories (Default, WithInitialValue, WithSuffix, WithMinMax, DecimalInput)
- Stories should be interactive and functional

**Step 4: Commit stories**

Run:
```bash
git add apps/frontend/src/lib/components/NumberInput.stories.ts && \
git commit -m "docs(frontend): add Storybook stories for NumberInput"
```

Expected: Commit created successfully

---

### Task 19: Create StarRatingWithGold Component - File Setup

**Files:**
- Create: `apps/frontend/src/lib/components/StarRatingWithGold.svelte`

**Step 1: Create component file**

Create `apps/frontend/src/lib/components/StarRatingWithGold.svelte`:

```svelte
<script lang="ts">
  interface Props {
    stars: number; // 0-6, where 6 = gold 5-star
    interactive?: boolean;
    onSelect?: (stars: number) => void;
  }

  let { stars = 0, interactive = false, onSelect }: Props = $props();

  let currentStars = $state(stars);
  let isGold = $state(stars === 6);

  // Sync with external changes
  $effect(() => {
    currentStars = stars === 6 ? 5 : stars;
    isGold = stars === 6;
  });

  function handleStarClick(index: number) {
    if (!interactive || !onSelect) return;

    const newStars = index + 1;
    currentStars = newStars;

    // Auto-disable gold if selecting less than 5 stars
    if (newStars < 5) {
      isGold = false;
      onSelect(newStars);
    } else {
      onSelect(isGold ? 6 : 5);
    }
  }

  function handleGoldToggle() {
    if (!interactive || !onSelect || currentStars < 5) return;

    isGold = !isGold;
    onSelect(isGold ? 6 : 5);
  }

  const starColor = $derived(isGold ? 'text-yellow-400' : 'text-gray-300');
  const filledStarColor = $derived(isGold ? 'text-yellow-400' : 'text-yellow-500');
</script>

<div class="flex items-center gap-3">
  <!-- 5 Stars -->
  <div class="flex items-center gap-1">
    {#each Array(5) as _, index}
      <button
        type="button"
        disabled={!interactive}
        onclick={() => handleStarClick(index)}
        class="text-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        class:cursor-pointer={interactive}
        class:cursor-default={!interactive}
      >
        {#if index < currentStars}
          <span class={filledStarColor}>★</span>
        {:else}
          <span class={starColor}>☆</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Gold Toggle (only show if 5 stars selected) -->
  {#if currentStars === 5}
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        bind:checked={isGold}
        onchange={handleGoldToggle}
        disabled={!interactive}
        class="form-checkbox h-4 w-4 text-yellow-500 rounded"
      />
      <span class="text-sm font-medium text-gray-700">Gold</span>
    </label>
  {/if}
</div>
```

**Step 2: Commit component skeleton**

Run:
```bash
git add apps/frontend/src/lib/components/StarRatingWithGold.svelte && \
git commit -m "feat(frontend): create StarRatingWithGold component"
```

Expected: Commit created successfully

---

### Task 20: Write StarRatingWithGold Tests

**Files:**
- Create: `apps/frontend/src/lib/components/StarRatingWithGold.test.ts`

**Step 1: Write test file**

Create `apps/frontend/src/lib/components/StarRatingWithGold.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StarRatingWithGold from './StarRatingWithGold.svelte';

describe('StarRatingWithGold', () => {
  it('renders 5 stars initially', () => {
    render(StarRatingWithGold, {
      props: { stars: 0, interactive: true }
    });

    const stars = screen.getAllByText(/[★☆]/);
    expect(stars).toHaveLength(5);
  });

  it('calls onSelect when star is clicked', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: {
        stars: 0,
        interactive: true,
        onSelect: mockSelect
      }
    });

    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[2]); // Click 3rd star

    expect(mockSelect).toHaveBeenCalledWith(3);
  });

  it('shows gold toggle only when 5 stars selected', async () => {
    const mockSelect = vi.fn();
    const { container } = render(StarRatingWithGold, {
      props: {
        stars: 0,
        interactive: true,
        onSelect: mockSelect
      }
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
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: {
        stars: 6, // Start with gold
        interactive: true,
        onSelect: mockSelect
      }
    });

    // Check stars have gold color class
    const filledStars = screen.getAllByText('★');
    expect(filledStars[0]).toHaveClass('text-yellow-400');
  });

  it('auto-disables gold when selecting less than 5 stars', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: {
        stars: 6, // Start with gold
        interactive: true,
        onSelect: mockSelect
      }
    });

    // Gold toggle should be visible and checked
    expect(screen.getByLabelText('Gold')).toBeChecked();

    // Click 3rd star
    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[2]);

    expect(mockSelect).toHaveBeenCalledWith(3);
    // Gold toggle should be gone
    expect(screen.queryByLabelText('Gold')).not.toBeInTheDocument();
  });

  it('stores value as 6 when gold is active', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: {
        stars: 5,
        interactive: true,
        onSelect: mockSelect
      }
    });

    // Toggle gold on
    const goldCheckbox = screen.getByLabelText('Gold');
    await fireEvent.click(goldCheckbox);

    expect(mockSelect).toHaveBeenCalledWith(6);
  });

  it('is not interactive when interactive=false', async () => {
    const mockSelect = vi.fn();
    render(StarRatingWithGold, {
      props: {
        stars: 3,
        interactive: false,
        onSelect: mockSelect
      }
    });

    const stars = screen.getAllByRole('button');
    await fireEvent.click(stars[4]);

    expect(mockSelect).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd apps/frontend && \
pnpm test StarRatingWithGold
```

Expected: Some tests may fail - fix component as needed

**Step 3: Commit tests**

Run:
```bash
git add apps/frontend/src/lib/components/StarRatingWithGold.test.ts && \
git commit -m "test(frontend): add StarRatingWithGold component tests"
```

Expected: Commit created successfully

---

### Task 21: Fix StarRatingWithGold to Pass Tests

**Files:**
- Modify: `apps/frontend/src/lib/components/StarRatingWithGold.svelte`

**Step 1: Run tests in watch mode**

Run: `cd apps/frontend && pnpm test StarRatingWithGold --watch`

**Step 2: Fix any failing tests**

Common issues:
- Gold toggle visibility logic
- Color class application
- Interactive state handling

**Step 3: Commit fixes**

Run:
```bash
git add apps/frontend/src/lib/components/StarRatingWithGold.svelte && \
git commit -m "fix(frontend): StarRatingWithGold passes all tests"
```

Expected: All StarRatingWithGold tests passing

---

### Task 22: Create StarRatingWithGold Storybook Stories

**Files:**
- Create: `apps/frontend/src/lib/components/StarRatingWithGold.stories.ts`

**Step 1: Create stories file**

Create `apps/frontend/src/lib/components/StarRatingWithGold.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import StarRatingWithGold from './StarRatingWithGold.svelte';

const meta = {
  title: 'Components/StarRatingWithGold',
  component: StarRatingWithGold,
  tags: ['autodocs'],
  argTypes: {
    stars: {
      control: { type: 'range', min: 0, max: 6, step: 1 }
    },
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

**Step 2: Verify stories in Storybook**

User should navigate to Storybook (already running or restart):
```bash
pnpm --filter @bearded-nemesis/frontend story:dev
```

Check:
- All 5 stories render correctly
- Interactive stories allow clicking stars
- Gold toggle appears/disappears correctly
- Gold stars are visually distinct

**Step 3: Commit stories**

Run:
```bash
git add apps/frontend/src/lib/components/StarRatingWithGold.stories.ts && \
git commit -m "docs(frontend): add Storybook stories for StarRatingWithGold"
```

Expected: Commit created successfully

---

## Phase 4: Composite Form Component

### Task 23: Create PlaythroughStatsForm Component - File Setup

**Files:**
- Create: `apps/frontend/src/lib/components/PlaythroughStatsForm.svelte`

**Step 1: Create component file with comprehensive structure**

Create `apps/frontend/src/lib/components/PlaythroughStatsForm.svelte`:

```svelte
<script lang="ts">
  import { DIFFICULTIES, type Difficulty } from '@bearded-nemesis/shared';
  import NumberInput from './NumberInput.svelte';
  import StarRatingWithGold from './StarRatingWithGold.svelte';
  import * as playthroughsApi from '$lib/api/playthroughs';
  import { toastStore } from '$lib/stores/toast';

  interface Props {
    playthroughId: number;
    position: number;
    currentUserId: number;
    playerDifficulty: Difficulty; // Fallback from playthrough player
    previousSongDifficulty?: Difficulty | null; // Preferred default
    existingStats?: {
      score?: number | null;
      accuracyPct?: number | null;
      difficulty?: Difficulty | null;
      starsEarned?: number | null;
      longestStreak?: number | null;
      notesHit?: number | null;
      notesMissed?: number | null;
      avgMultiplier?: number | null;
    };
  }

  let {
    playthroughId,
    position,
    currentUserId,
    playerDifficulty,
    previousSongDifficulty,
    existingStats
  }: Props = $props();

  // Form state
  let completionPct = $state(existingStats?.accuracyPct ?? '');
  let difficulty = $state<Difficulty>(
    existingStats?.difficulty ??
    previousSongDifficulty ??
    playerDifficulty
  );
  let score = $state(existingStats?.score ?? '');
  let stars = $state(existingStats?.starsEarned ?? 0);
  let longestStreak = $state(existingStats?.longestStreak ?? '');
  let notesHit = $state(existingStats?.notesHit ?? '');
  let notesMissed = $state(existingStats?.notesMissed ?? '');
  let avgMultiplier = $state(existingStats?.avgMultiplier ?? '');

  async function saveField(field: string, value: any) {
    try {
      await playthroughsApi.updateStats(
        playthroughId,
        position,
        currentUserId,
        { [field]: value }
      );
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      toastStore.error(`Failed to save ${field}`);
      throw err;
    }
  }

  async function handleDifficultyChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newDifficulty = target.value as Difficulty;
    difficulty = newDifficulty;
    await saveField('difficulty', newDifficulty);
  }
</script>

<form class="card bg-white p-4">
  <h3 class="font-semibold mb-4 text-lg">My Stats</h3>

  <!-- Results Section -->
  <div class="mb-4">
    <h4 class="text-sm font-medium text-gray-600 mb-2">Results</h4>

    <NumberInput
      value={completionPct}
      label="Completion"
      suffix="%"
      min={0}
      max={100}
      step={0.1}
      inputmode="decimal"
      onSave={async (val) => {
        completionPct = val ?? '';
        await saveField('accuracyPct', val);
      }}
    />

    <div class="mb-3">
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Skill Level
      </label>
      <select
        bind:value={difficulty}
        onchange={handleDifficultyChange}
        class="input w-full"
      >
        {#each DIFFICULTIES as diff}
          <option value={diff}>{diff}</option>
        {/each}
      </select>
    </div>

    <NumberInput
      value={score}
      label="Score"
      inputmode="numeric"
      onSave={async (val) => {
        score = val ?? '';
        await saveField('score', val);
      }}
    />

    <div class="mb-3">
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Stars
      </label>
      <StarRatingWithGold
        {stars}
        interactive={true}
        onSelect={async (newStars) => {
          stars = newStars;
          await saveField('starsEarned', newStars);
        }}
      />
    </div>
  </div>

  <!-- Performance Section -->
  <div>
    <h4 class="text-sm font-medium text-gray-600 mb-2">Performance</h4>

    <NumberInput
      value={longestStreak}
      label="Longest Streak"
      inputmode="numeric"
      onSave={async (val) => {
        longestStreak = val ?? '';
        await saveField('longestStreak', val);
      }}
    />

    <NumberInput
      value={notesHit}
      label="Notes Hit"
      inputmode="numeric"
      onSave={async (val) => {
        notesHit = val ?? '';
        await saveField('notesHit', val);
      }}
    />

    <NumberInput
      value={notesMissed}
      label="Notes Missed"
      inputmode="numeric"
      onSave={async (val) => {
        notesMissed = val ?? '';
        await saveField('notesMissed', val);
      }}
    />

    <NumberInput
      value={avgMultiplier}
      label="Avg. Multiplier"
      step={0.1}
      inputmode="decimal"
      onSave={async (val) => {
        avgMultiplier = val ?? '';
        await saveField('avgMultiplier', val);
      }}
    />
  </div>
</form>
```

**Step 2: Commit component skeleton**

Run:
```bash
git add apps/frontend/src/lib/components/PlaythroughStatsForm.svelte && \
git commit -m "feat(frontend): create PlaythroughStatsForm composite component"
```

Expected: Commit created successfully

---

### Task 24: Update API Endpoint to Accept New Fields

**Files:**
- Modify: `apps/api/src/routes/playthroughs.ts` (find the update stats endpoint)

**Step 1: Locate the update stats endpoint**

Run: `grep -n "updateStats\|PATCH.*stats" apps/api/src/routes/playthroughs.ts`

Expected: Line number of the stats update endpoint

**Step 2: Add difficulty and avgMultiplier validation**

Around the stats update endpoint, add validation:

```typescript
// Existing validations...

if (body.difficulty !== undefined) {
  if (!['easy', 'medium', 'hard', 'expert'].includes(body.difficulty)) {
    return reply.code(400).send({ error: 'Invalid difficulty' });
  }
}

if (body.avgMultiplier !== undefined && body.avgMultiplier !== null) {
  if (typeof body.avgMultiplier !== 'number' || body.avgMultiplier < 0) {
    return reply.code(400).send({ error: 'Invalid avgMultiplier' });
  }
}
```

**Step 3: Pass new fields to repository**

Ensure the endpoint passes `difficulty` and `avgMultiplier` to the repository update call.

**Step 4: Commit endpoint updates**

Run:
```bash
git add apps/api/src/routes/playthroughs.ts && \
git commit -m "feat(api): accept difficulty and avgMultiplier in stats update endpoint"
```

Expected: Commit created successfully

---

### Task 25: Write API Tests for New Fields

**Files:**
- Modify: `apps/api/src/routes/playthroughs.test.ts`

**Step 1: Find existing stats update tests**

Run: `grep -n "update.*stats\|PATCH.*stats" apps/api/src/routes/playthroughs.test.ts`

**Step 2: Add test for difficulty validation**

Add test case:

```typescript
it('should validate difficulty field', async () => {
  // Setup: create playthrough, song, etc.

  const response = await app.inject({
    method: 'PATCH',
    url: `/api/playthroughs/${playthroughId}/songs/${position}/stats/${userId}`,
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    payload: {
      difficulty: 'invalid'
    }
  });

  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.body).error).toContain('difficulty');
});

it('should accept valid difficulty', async () => {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/playthroughs/${playthroughId}/songs/${position}/stats/${userId}`,
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    payload: {
      difficulty: 'expert'
    }
  });

  expect(response.statusCode).toBe(200);
});
```

**Step 3: Add test for avgMultiplier**

```typescript
it('should accept decimal avgMultiplier', async () => {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/playthroughs/${playthroughId}/songs/${position}/stats/${userId}`,
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    payload: {
      avgMultiplier: 3.8
    }
  });

  expect(response.statusCode).toBe(200);
  const stats = JSON.parse(response.body);
  expect(stats.avgMultiplier).toBe(3.8);
});
```

**Step 4: Run API tests**

Run:
```bash
cd apps/api && \
pnpm test playthroughs
```

Expected: All tests pass (including new ones)

**Step 5: Commit test updates**

Run:
```bash
git add apps/api/src/routes/playthroughs.test.ts && \
git commit -m "test(api): add tests for difficulty and avgMultiplier validation"
```

Expected: Commit created successfully

---

### Task 26: Write PlaythroughStatsForm Tests

**Files:**
- Create: `apps/frontend/src/lib/components/PlaythroughStatsForm.test.ts`

**Step 1: Create test file**

Create `apps/frontend/src/lib/components/PlaythroughStatsForm.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PlaythroughStatsForm from './PlaythroughStatsForm.svelte';
import * as playthroughsApi from '$lib/api/playthroughs';

vi.mock('$lib/api/playthroughs');
vi.mock('$lib/stores/toast', () => ({
  toastStore: {
    error: vi.fn(),
    success: vi.fn()
  }
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

  it('saves difficulty when dropdown changes', async () => {
    render(PlaythroughStatsForm, {
      props: {
        playthroughId: 1,
        position: 0,
        currentUserId: 1,
        playerDifficulty: 'medium'
      }
    });

    const difficultySelect = screen.getByLabelText('Skill Level');
    await fireEvent.change(difficultySelect, { target: { value: 'expert' } });

    await waitFor(() => {
      expect(playthroughsApi.updateStats).toHaveBeenCalledWith(
        1, 0, 1,
        { difficulty: 'expert' }
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

**Step 2: Run tests**

Run:
```bash
cd apps/frontend && \
pnpm test PlaythroughStatsForm
```

Expected: Tests may fail - fix component as needed

**Step 3: Commit tests**

Run:
```bash
git add apps/frontend/src/lib/components/PlaythroughStatsForm.test.ts && \
git commit -m "test(frontend): add PlaythroughStatsForm component tests"
```

Expected: Commit created successfully

---

### Task 27: Fix PlaythroughStatsForm to Pass Tests

**Files:**
- Modify: `apps/frontend/src/lib/components/PlaythroughStatsForm.svelte`

**Step 1: Run tests in watch mode**

Run: `cd apps/frontend && pnpm test PlaythroughStatsForm --watch`

**Step 2: Fix failing tests**

Common issues:
- API call parameters
- State management
- Error handling

**Step 3: Commit fixes**

Run:
```bash
git add apps/frontend/src/lib/components/PlaythroughStatsForm.svelte && \
git commit -m "fix(frontend): PlaythroughStatsForm passes all tests"
```

Expected: All tests passing

---

### Task 28: Create PlaythroughStatsForm Storybook Stories

**Files:**
- Create: `apps/frontend/src/lib/components/PlaythroughStatsForm.stories.ts`

**Step 1: Create stories file**

Create `apps/frontend/src/lib/components/PlaythroughStatsForm.stories.ts`:

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

**Step 2: Verify stories in Storybook**

Navigate to Storybook and check:
- Form renders correctly in all states
- Mobile view is usable
- Fields save on blur (check console)
- Tab order works

**Step 3: Commit stories**

Run:
```bash
git add apps/frontend/src/lib/components/PlaythroughStatsForm.stories.ts && \
git commit -m "docs(frontend): add Storybook stories for PlaythroughStatsForm"
```

Expected: Commit created successfully

---

### Task 29: Integrate PlaythroughStatsForm into Active Playthrough Page

**Files:**
- Modify: `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte`

**Step 1: Import PlaythroughStatsForm**

At top of script section, add:

```diff
  import PlaythroughSummaryHeader from '$lib/components/PlaythroughSummaryHeader.svelte';
  import PlaythroughSongCard from '$lib/components/PlaythroughSongCard.svelte';
+ import PlaythroughStatsForm from '$lib/components/PlaythroughStatsForm.svelte';
  import { toastStore } from '$lib/stores/toast';
```

**Step 2: Find current user's difficulty**

Add derived state:

```typescript
const currentUserPlayer = $derived(
  currentState?.players.find(p => p.userId === $authStore.user?.id)
);
```

**Step 3: Get previous song difficulty**

Add logic to fetch previous song's difficulty from summary:

```typescript
const previousSongDifficulty = $derived(() => {
  if (!summary || !currentState || currentState.currentPosition === 0) return null;

  const prevPosition = currentState.currentPosition - 1;
  const prevSong = summary.songs.find(s => s.position === prevPosition);
  const prevStats = prevSong?.stats.find(s => s.userId === $authStore.user?.id);

  return prevStats?.difficulty ?? null;
});
```

**Step 4: Add PlaythroughStatsForm between rating and screenshot sections**

Around line 339 (after "My Rating" card, before "Screenshot Upload" card):

```diff
      </div>
    </div>

+   <!-- My Stats Form -->
+   {#if currentUserPlayer}
+     <PlaythroughStatsForm
+       {playthroughId}
+       position={currentState.currentPosition}
+       currentUserId={$authStore.user.id}
+       playerDifficulty={currentUserPlayer.difficulty}
+       previousSongDifficulty={previousSongDifficulty()}
+       existingStats={summary?.songs
+         .find(s => s.position === currentState.currentPosition)
+         ?.stats.find(s => s.userId === $authStore.user.id)}
+     />
+   {/if}

    <!-- Screenshot Upload -->
    <div class="card mb-6">
```

**Step 5: Commit integration**

Run:
```bash
git add apps/frontend/src/routes/\(protected\)/playthroughs/\[id\]/+page.svelte && \
git commit -m "feat(frontend): integrate PlaythroughStatsForm into active playthrough page"
```

Expected: Commit created successfully

---

## Phase 5: Remove OCR from Frontend

### Task 30: Remove OCR Status from PlaythroughSongCard

**Files:**
- Modify: `apps/frontend/src/lib/components/PlaythroughSongCard.svelte`

**Step 1: Remove OCR status derived state**

Remove lines 27-44 (ocrIcon, ocrColor, hasIncompleteData):

```diff
- const ocrIcon = $derived(
-   songData.ocrStatus === 'completed' ? '✓' :
-   songData.ocrStatus === 'pending' ? '⚠️' :
-   songData.ocrStatus === 'failed' ? '✗' :
-   '○'
- );
-
- const ocrColor = $derived(
-   songData.ocrStatus === 'completed' ? 'text-green-600' :
-   songData.ocrStatus === 'pending' ? 'text-yellow-600' :
-   songData.ocrStatus === 'failed' ? 'text-red-600' :
-   'text-gray-400'
- );
-
- const hasIncompleteData = $derived(
-   songData.ratings.length < players.length ||
-   (songData.screenshotPath && songData.ocrStatus !== 'completed')
- );
```

**Step 2: Remove OCR indicator from summary stats**

Remove line 81 (OCR status display):

```diff
      <div class="flex items-center gap-4 text-sm flex-shrink-0">
        <span class="text-gray-600">{songData.ratings.length} players rated</span>
        {#if avgRating}
          <span class="text-yellow-500">Avg: {avgRating}★</span>
        {/if}
-       <span class={ocrColor}>{ocrIcon}</span>
      </div>
```

**Step 3: Remove yellow border for incomplete data**

Remove lines 55-56:

```diff
  <div
    class="card mb-4 cursor-pointer hover:bg-gray-50 transition-colors"
-   class:border-l-4={hasIncompleteData}
-   class:border-yellow-400={hasIncompleteData}
    onclick={() => expanded = !expanded}
  >
```

**Step 4: Keep screenshot section but simplify**

Keep lines 194-207 (Screenshot section) but remove OCR status text:

```diff
      <!-- Screenshot & OCR -->
      <div>
-       <h3 class="font-semibold mb-3">Screenshot & OCR</h3>
+       <h3 class="font-semibold mb-3">Screenshot</h3>
        {#if songData.screenshotPath}
          <button
            class="text-blue-600 hover:underline"
            onclick={(e) => { e.stopPropagation(); showingScreenshot = true; }}
          >
-           Screenshot: <span class={ocrColor}>{ocrIcon}</span> View
+           View Screenshot
          </button>
        {:else}
          <p class="text-gray-500 text-sm">No screenshot uploaded</p>
        {/if}
      </div>
```

**Step 5: Remove onRerunOCR prop from ScreenshotModal**

Around line 218:

```diff
  {#if showingScreenshot && songData.screenshotPath}
    <ScreenshotModal
      screenshotPath={songData.screenshotPath}
      {playthroughId}
      position={songData.position}
      onClose={() => showingScreenshot = false}
-     onRerunOCR={onStatsUpdated}
    />
  {/if}
```

**Step 6: Commit changes**

Run:
```bash
git add apps/frontend/src/lib/components/PlaythroughSongCard.svelte && \
git commit -m "refactor(frontend): remove OCR status indicators from PlaythroughSongCard"
```

Expected: Commit created successfully

---

### Task 31: Remove Re-run OCR Button from ScreenshotModal

**Files:**
- Modify: `apps/frontend/src/lib/components/ScreenshotModal.svelte`

**Step 1: Remove onRerunOCR from Props interface**

Remove line 10:

```diff
  interface Props {
    screenshotPath: string;
    playthroughId: number;
    position: number;
    onClose: () => void;
-   onRerunOCR?: () => void;
  }
```

**Step 2: Remove onRerunOCR from destructuring**

Line 13:

```diff
- let { screenshotPath, playthroughId, position, onClose, onRerunOCR }: Props = $props();
+ let { screenshotPath, playthroughId, position, onClose }: Props = $props();
```

**Step 3: Remove rerunning state and handler**

Remove lines 15-30:

```diff
- let rerunning = $state(false);
-
- async function handleRerunOCR() {
-   rerunning = true;
-   try {
-     await playthroughsApi.retryOCR(playthroughId, position);
-     toastStore.success('OCR retry started');
-     onRerunOCR?.();
-     onClose();
-   } catch (err) {
-     console.error('Failed to retry OCR:', err);
-     toastStore.error('Failed to retry OCR');
-   } finally {
-     rerunning = false;
-   }
- }
```

**Step 4: Remove Re-run OCR button**

Remove lines 44-48:

```diff
    <div class="flex gap-2">
-     {#if onRerunOCR}
-       <button onclick={handleRerunOCR} class="btn btn-secondary" disabled={rerunning}>
-         {rerunning ? 'Processing...' : 'Re-run OCR'}
-       </button>
-     {/if}
      <button onclick={onClose} class="btn btn-primary">Close</button>
    </div>
```

**Step 5: Remove unused imports**

Remove lines 2-3:

```diff
  <script lang="ts">
-   import { toastStore } from '$lib/stores/toast';
-   import * as playthroughsApi from '$lib/api/playthroughs';
```

**Step 6: Commit changes**

Run:
```bash
git add apps/frontend/src/lib/components/ScreenshotModal.svelte && \
git commit -m "refactor(frontend): remove Re-run OCR button from ScreenshotModal"
```

Expected: Commit created successfully

---

### Task 32: Remove OCR WebSocket Event Handlers from Playthrough Page

**Files:**
- Modify: `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte`

**Step 1: Remove screenshot uploaded handler**

Remove lines 96-102:

```diff
-   wsService.screenshotUploaded.subscribe(event => {
-     if (event) {
-       console.log('Screenshot uploaded event. Status:', playthrough?.status);
-       // Don't reload summary here - the optimistic update in handleFileUpload already set status to 'pending'
-       // We'll reload when OCR completes
-     }
-   });
```

**Step 2: Remove OCR completed handler**

Remove lines 104-110:

```diff
-   wsService.ocrCompleted.subscribe(event => {
-     if (event) {
-       console.log('OCR completed event, reloading data. Status:', playthrough?.status, 'Players matched:', event.playersMatched);
-       // Load summary to get the latest stats/OCR data without disrupting UI
-       loadSummary();
-     }
-   });
```

**Step 3: Simplify screenshot upload handler**

Around line 176, remove optimistic OCR status update:

```diff
  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !currentState) return;

    const currentPosition = currentState.currentPosition;
    uploading = true;
    try {
      await playthroughsApi.uploadScreenshot(playthroughId, currentPosition, file);
-
-     // Optimistically update UI to show "Processing" and clear old stats
-     if (summary) {
-       summary = {
-         ...summary,
-         songs: summary.songs.map(song =>
-           song.position === currentPosition
-             ? { ...song, ocrStatus: 'pending', stats: [], screenshotPath: song.screenshotPath || 'uploading' }
-             : song
-         )
-       };
-     }
+     toastStore.success('Screenshot uploaded');
    } catch (err) {
      console.error('Failed to upload screenshot:', err);
      toastStore.error('Failed to upload screenshot');
    } finally {
      uploading = false;
      target.value = '';
    }
  }
```

**Step 4: Remove OCR status display from active playthrough**

Remove lines 360-407 (OCR Results section in Screenshot Upload card):

```diff
        <button
          onclick={triggerFileUpload}
          class="btn btn-secondary w-full"
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Take/Upload Screenshot'}
        </button>
-
-       <!-- OCR Stats for Current Song -->
-       {#if summary}
-         {@const currentSongData = summary.songs.find(s => s.position === currentState?.currentPosition)}
-         {#if currentSongData && currentSongData.screenshotPath}
-           <div class="mt-4 pt-4 border-t">
-             ...entire OCR results section...
-           </div>
-         {/if}
-       {/if}
      </div>
```

**Step 5: Commit changes**

Run:
```bash
git add apps/frontend/src/routes/\(protected\)/playthroughs/\[id\]/+page.svelte && \
git commit -m "refactor(frontend): remove OCR WebSocket handlers and status display from active playthrough"
```

Expected: Commit created successfully

---

### Task 33: Run All Frontend Tests

**Files:**
- N/A (Test execution)

**Step 1: Run all frontend tests**

Run:
```bash
cd apps/frontend && \
pnpm test
```

Expected: All tests pass

**Step 2: If tests fail, fix issues**

Common failures:
- Components expecting removed props
- Missing imports
- Type errors from removed fields

**Step 3: Commit test fixes (if needed)**

If fixes were needed:
```bash
git add apps/frontend/src && \
git commit -m "fix(frontend): resolve test failures after OCR removal"
```

**Step 4: Commit test verification**

Run:
```bash
git commit --allow-empty -m "test: all frontend tests pass after OCR removal"
```

Expected: Empty commit created

---

## Phase 6: Final Verification

### Task 34: Manual Testing - Start Services

**Files:**
- N/A (Service startup)

**Step 1: Ensure database is running**

Run: `docker-compose up -d postgres`

Expected: PostgreSQL running on port 5434

**Step 2: Ensure solver is running**

Run: `docker-compose up -d solver`

Expected: Solver service running on port 8081

**Step 3: Build shared package**

Run: `pnpm --filter @bearded-nemesis/shared build`

Expected: Build succeeds

**Step 4: Start API server**

Run: `pnpm --filter @bearded-nemesis/api dev`

Expected: API running on port 3010

**Step 5: Start frontend dev server** (in new terminal)

Run: `pnpm --filter @bearded-nemesis/frontend dev`

Expected: Frontend running on port 5173

---

### Task 35: Manual Testing - Test Stats Form Flow

**Files:**
- N/A (Manual testing)

**Step 1: Create a playthrough**

Navigate to http://localhost:5173 and:
1. Log in
2. Create or select a setlist
3. Start a playthrough

**Step 2: Test stats entry on first song**

1. Rate the song (1-5 stars)
2. Scroll to "My Stats" form
3. Enter completion % (e.g., 95)
4. Verify difficulty defaults to your playthrough difficulty
5. Enter score (e.g., 12345)
6. Select stars (try 5 stars, toggle gold)
7. Enter longest streak, notes hit/missed, avg multiplier
8. Verify each field saves (watch browser console)

**Step 3: Advance to next song**

1. Click "Next" button
2. Enter stats for second song
3. Change difficulty to something different
4. Verify difficulty dropdown shows your previous song's difficulty as default

**Step 4: Test Enter/Tab navigation**

1. Tab through form fields
2. Press Enter in a field
3. Verify focus moves to next field

**Step 5: Test screenshot upload**

1. Upload/take a screenshot
2. Verify "Screenshot uploaded" toast appears
3. Verify NO OCR processing indicators appear

**Step 6: Finish playthrough**

1. Click "Finish Playthrough"
2. View summary
3. Verify stats are displayed correctly
4. Verify screenshot can be viewed
5. Verify NO OCR status or "Re-run OCR" button appears

**Step 7: Document results**

If everything works:
```bash
git commit --allow-empty -m "verify: manual testing confirms stats form works correctly"
```

If issues found, fix them and commit fixes before continuing.

---

### Task 36: Mobile Device Testing

**Files:**
- N/A (Mobile testing)

**Step 1: Expose dev server to mobile device**

If testing on physical device on same network:

Run: `pnpm --filter @bearded-nemesis/frontend dev --host`

Note the network URL (e.g., http://192.168.1.100:5173)

**Step 2: Test on mobile browser**

1. Open network URL on mobile device
2. Start a playthrough
3. Test stats form:
   - Verify fields are large enough to tap
   - Verify numeric keyboard appears for number fields
   - Verify "Next" button appears in keyboard
   - Test tapping "Next" to advance fields
   - Verify star selector is easy to use
   - Verify gold toggle is accessible

**Step 3: Test screenshot from camera**

1. Tap "Take/Upload Screenshot"
2. Verify camera option appears
3. Take a photo
4. Verify upload succeeds

**Step 4: Document results**

```bash
git commit --allow-empty -m "verify: mobile testing confirms responsive design and usability"
```

---

### Task 37: Verify LP Optimization Still Works

**Files:**
- N/A (Integration testing)

**Step 1: Create a builder setlist**

Via frontend:
1. Navigate to setlists
2. Create new "Builder" type setlist
3. Add constraints (e.g., 5-10 songs, high ratings)
4. Click "Build Setlist"

**Step 2: Verify solver endpoint is called**

Check browser network tab:
- POST to http://localhost:8081/solve
- Response includes selectedSongIds

**Step 3: Verify setlist is built correctly**

- Setlist should contain songs
- Songs should match constraints
- Order should be optimized

**Step 4: Commit verification**

Run:
```bash
git commit --allow-empty -m "verify: LP optimization via solver service works correctly"
```

Expected: Empty commit created

---

### Task 38: Final Commit and Summary

**Files:**
- N/A (Meta task)

**Step 1: Review all changes**

Run:
```bash
git log --oneline --since="1 day ago"
```

Expected: ~30-40 commits from this implementation

**Step 2: Create final summary commit**

Run:
```bash
git commit --allow-empty -m "feat: complete playthrough streamline implementation

Summary of changes:
- Removed PaddleOCR from solver service
- Added difficulty and avgMultiplier to stats schema
- Created NumberInput, StarRatingWithGold, and PlaythroughStatsForm components
- Added Storybook stories for all new components
- Integrated stats form into active playthrough page
- Removed OCR UI from frontend
- All tests passing
- Manual and mobile testing confirmed

The app now supports quick manual stats entry optimized for mobile devices,
while preserving screenshot upload for future OCR re-enablement."
```

**Step 3: Push to remote**

Run:
```bash
git push origin main
```

Expected: All commits pushed successfully

---

## Completion Checklist

✅ OCR removed from solver service, LP optimization preserved
✅ Migration 005 applied successfully
✅ Shared types updated with new fields
✅ Stats repository handles difficulty and avgMultiplier
✅ API endpoint validates new fields
✅ NumberInput component created with tests and stories
✅ StarRatingWithGold component created with tests and stories
✅ PlaythroughStatsForm component created with tests and stories
✅ Stats form integrated into active playthrough page
✅ OCR indicators removed from PlaythroughSongCard
✅ Re-run OCR button removed from ScreenshotModal
✅ OCR WebSocket handlers removed from playthrough page
✅ All frontend tests passing
✅ All API tests passing
✅ Manual testing confirms stats form works
✅ Mobile testing confirms responsive design
✅ LP optimization verified working
✅ Changes committed and pushed

## Notes for Future OCR Re-enablement

See `docs/removed-features/ocr-2025-12-09.md` for complete re-enablement instructions.

Key files preserved:
- `apps/solver/app/ocr/` - Complete OCR implementation
- Database columns: `screenshot_path`, `ocr_status`, `ocr_error`, `ocr_processed_at`
- Screenshot upload and viewing infrastructure

To re-enable:
1. Restore PaddleOCR dependencies
2. Restore OCR endpoints to solver
3. Restore OCR UI elements to frontend
4. Test end-to-end flow
