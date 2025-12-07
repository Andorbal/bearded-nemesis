# Playthrough Completion Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace basic "Playthrough Complete!" message with comprehensive summary showing expandable song cards with ratings, statistics, and editing capability.

**Architecture:** Add consolidated `/summary` API endpoint to fetch all playthrough data in one call. Build modular Svelte components for header, expandable song cards, stats editor, and screenshot modal. Support inline editing of OCR stats with validation.

**Tech Stack:** Fastify, PostgreSQL, SvelteKit 5, Vitest, Testing Library

---

## Task 1: Add Summary Endpoint - Repository Methods

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts`
- Test: `apps/api/src/repositories/playthroughSongStatsRepository.test.ts`

**Step 1: Write failing test for getStatsForPlaythrough**

Add to `apps/api/src/repositories/playthroughSongStatsRepository.test.ts`:

```typescript
describe('getStatsForPlaythrough', () => {
  it('returns all stats for playthrough grouped by song position', async () => {
    const user1 = await userRepo.create({
      username: 'player1',
      password: 'pass',
      displayName: 'Player 1'
    });

    const playthrough = await playthroughRepo.create({
      setlistId: 1,
      createdBy: user1.id,
      status: 'finished'
    });

    const song1 = await playthroughSongRepo.create({
      playthroughId: playthrough.id,
      songId: 1,
      position: 0
    });

    const song2 = await playthroughSongRepo.create({
      playthroughId: playthrough.id,
      songId: 2,
      position: 1
    });

    await playthroughSongStatsRepo.create({
      playthroughSongId: song1.id,
      userId: user1.id,
      score: 100000,
      rating: 5
    });

    const result = await playthroughSongStatsRepo.getStatsForPlaythrough(playthrough.id);

    expect(result).toHaveLength(1);
    expect(result[0].playthroughSongId).toBe(song1.id);
    expect(result[0].score).toBe(100000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @bearded-nemesis/api test playthroughSongStatsRepository
```

Expected: FAIL with "getStatsForPlaythrough is not a function"

**Step 3: Implement getStatsForPlaythrough method**

Add to `apps/api/src/repositories/playthroughSongStatsRepository.ts`:

```typescript
export async function getStatsForPlaythrough(playthroughId: number): Promise<PlaythroughSongStats[]> {
  const result = await db.query<PlaythroughSongStats>(
    `SELECT pss.*
     FROM playthrough_song_stats pss
     JOIN playthrough_songs ps ON pss.playthrough_song_id = ps.id
     WHERE ps.playthrough_id = $1
     ORDER BY ps.position, pss.user_id`,
    [playthroughId]
  );
  return result.rows;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @bearded-nemesis/api test playthroughSongStatsRepository
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts apps/api/src/repositories/playthroughSongStatsRepository.test.ts
git commit -m "feat(api): add getStatsForPlaythrough repository method

Add method to fetch all stats for a playthrough grouped by song position.
Needed for consolidated summary endpoint.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Summary Endpoint - Route Handler

**Files:**
- Modify: `apps/api/src/routes/playthroughs.ts`
- Test: `apps/api/src/routes/playthroughs.test.ts`

**Step 1: Write failing test for GET /playthroughs/:id/summary**

Add to `apps/api/src/routes/playthroughs.test.ts`:

```typescript
describe('GET /playthroughs/:id/summary', () => {
  it('returns complete playthrough summary', async () => {
    const user = await createTestUser();
    const token = await generateToken(user);

    const setlist = await setlistRepo.create({
      userId: user.id,
      name: 'Test Setlist',
      type: 'manual'
    });

    await setlistSongRepo.addSong(setlist.id, 1, 0);
    await setlistSongRepo.addSong(setlist.id, 2, 1);

    const playthrough = await playthroughRepo.create({
      setlistId: setlist.id,
      createdBy: user.id,
      status: 'finished'
    });

    await playthroughPlayerRepo.addPlayer({
      playthroughId: playthrough.id,
      userId: user.id,
      instrument: 'drums',
      difficulty: 'expert',
      isProMode: false
    });

    const song1 = await playthroughSongRepo.create({
      playthroughId: playthrough.id,
      songId: 1,
      position: 0
    });

    await playthroughSongStatsRepo.create({
      playthroughSongId: song1.id,
      userId: user.id,
      score: 100000,
      rating: 5,
      accuracyPct: 98.5
    });

    const response = await app.inject({
      method: 'GET',
      url: `/playthroughs/${playthrough.id}/summary`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.playthrough.id).toBe(playthrough.id);
    expect(body.setlist.name).toBe('Test Setlist');
    expect(body.players).toHaveLength(1);
    expect(body.songs).toHaveLength(2);

    expect(body.songs[0].position).toBe(0);
    expect(body.songs[0].song.id).toBe(1);
    expect(body.songs[0].ratings).toHaveLength(1);
    expect(body.songs[0].ratings[0].rating).toBe(5);
    expect(body.songs[0].stats).toHaveLength(1);
    expect(body.songs[0].stats[0].score).toBe(100000);
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/playthroughs/1/summary'
    });

    expect(response.statusCode).toBe(401);
  });

  it('enforces access control (participant or host only)', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser({ username: 'other' });
    const token2 = await generateToken(user2);

    const setlist = await setlistRepo.create({
      userId: user1.id,
      name: 'Test',
      type: 'manual'
    });

    const playthrough = await playthroughRepo.create({
      setlistId: setlist.id,
      createdBy: user1.id,
      status: 'finished'
    });

    const response = await app.inject({
      method: 'GET',
      url: `/playthroughs/${playthrough.id}/summary`,
      headers: { authorization: `Bearer ${token2}` }
    });

    expect(response.statusCode).toBe(403);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @bearded-nemesis/api test playthroughs
```

Expected: FAIL with 404 Not Found (route doesn't exist)

**Step 3: Implement GET /playthroughs/:id/summary route**

Add to `apps/api/src/routes/playthroughs.ts` after the GET /:id route:

```typescript
// Get playthrough summary (for completion screen)
app.get('/:id/summary', async (request, reply) => {
  const { id } = playthroughIdSchema.parse(request.params);

  const playthrough = await playthroughRepo.findById(id);
  if (!playthrough) {
    return reply.status(404).send({ error: 'Playthrough not found' });
  }

  // Check access: host or participant
  const isHost = playthrough.createdBy === request.user.userId;
  const isParticipant = await playthroughPlayerRepo.isPlayer(id, request.user.userId);

  if (!isHost && !isParticipant && !request.user.isAdmin) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // Fetch all related data
  const setlist = await setlistRepo.findById(playthrough.setlistId);
  const players = await playthroughPlayerRepo.getPlayers(id);
  const playthroughSongs = await playthroughSongRepo.getSongs(id);
  const allStats = await playthroughSongStatsRepo.getStatsForPlaythrough(id);

  // Build song data with ratings and stats
  const songs = await Promise.all(
    playthroughSongs.map(async (ps) => {
      const song = await songRepo.findById(ps.songId);

      // Get stats for this song
      const songStats = allStats.filter(s => s.playthroughSongId === ps.id);

      // Build stats array with username
      const stats = await Promise.all(
        songStats.map(async (stat) => {
          const user = await userRepo.findById(stat.userId);
          return {
            userId: stat.userId,
            username: user?.username || 'Unknown',
            score: stat.score,
            accuracyPct: stat.accuracyPct,
            notesHit: stat.notesHit,
            notesMissed: stat.notesMissed,
            longestStreak: stat.longestStreak,
            starsEarned: stat.starsEarned
          };
        })
      );

      // Build ratings array
      const ratings = songStats
        .filter(s => s.rating !== null)
        .map(s => ({
          userId: s.userId,
          username: stats.find(st => st.userId === s.userId)?.username || 'Unknown',
          rating: s.rating!
        }));

      return {
        position: ps.position,
        song: song!,
        screenshotPath: ps.screenshotPath,
        ocrStatus: ps.ocrStatus,
        ratings,
        stats
      };
    })
  );

  return {
    playthrough,
    setlist: setlist ? { id: setlist.id, name: setlist.name } : null,
    players,
    songs
  };
});
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @bearded-nemesis/api test playthroughs
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/playthroughs.ts apps/api/src/routes/playthroughs.test.ts
git commit -m "feat(api): add GET /playthroughs/:id/summary endpoint

Add consolidated endpoint that returns all playthrough data in one call:
- Playthrough and setlist info
- All players
- All songs with their ratings and OCR stats

Reduces N+1 queries for completion screen.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Update Stats Endpoint

**Files:**
- Modify: `apps/api/src/repositories/playthroughSongStatsRepository.ts`
- Modify: `apps/api/src/routes/playthroughs.ts`
- Test: `apps/api/src/repositories/playthroughSongStatsRepository.test.ts`
- Test: `apps/api/src/routes/playthroughs.test.ts`

**Step 1: Write failing test for updateStats repository method**

Add to `apps/api/src/repositories/playthroughSongStatsRepository.test.ts`:

```typescript
describe('updateStats', () => {
  it('updates stats for a user on a song', async () => {
    const user = await userRepo.create({
      username: 'player',
      password: 'pass',
      displayName: 'Player'
    });

    const playthrough = await playthroughRepo.create({
      setlistId: 1,
      createdBy: user.id,
      status: 'in_progress'
    });

    const song = await playthroughSongRepo.create({
      playthroughId: playthrough.id,
      songId: 1,
      position: 0
    });

    const stats = await playthroughSongStatsRepo.create({
      playthroughSongId: song.id,
      userId: user.id,
      score: 100000
    });

    const updated = await playthroughSongStatsRepo.updateStats(stats.id, {
      score: 150000,
      accuracyPct: 99.5,
      starsEarned: 6
    });

    expect(updated?.score).toBe(150000);
    expect(updated?.accuracyPct).toBe(99.5);
    expect(updated?.starsEarned).toBe(6);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @bearded-nemesis/api test playthroughSongStatsRepository
```

Expected: FAIL with "updateStats is not a function"

**Step 3: Implement updateStats repository method**

Add to `apps/api/src/repositories/playthroughSongStatsRepository.ts`:

```typescript
export interface UpdateStatsInput {
  score?: number;
  accuracyPct?: number;
  notesHit?: number;
  notesMissed?: number;
  longestStreak?: number;
  starsEarned?: number;
}

export async function updateStats(
  id: number,
  updates: UpdateStatsInput
): Promise<PlaythroughSongStats | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.score !== undefined) {
    fields.push(`score = $${paramIndex++}`);
    values.push(updates.score);
  }
  if (updates.accuracyPct !== undefined) {
    fields.push(`accuracy_pct = $${paramIndex++}`);
    values.push(updates.accuracyPct);
  }
  if (updates.notesHit !== undefined) {
    fields.push(`notes_hit = $${paramIndex++}`);
    values.push(updates.notesHit);
  }
  if (updates.notesMissed !== undefined) {
    fields.push(`notes_missed = $${paramIndex++}`);
    values.push(updates.notesMissed);
  }
  if (updates.longestStreak !== undefined) {
    fields.push(`longest_streak = $${paramIndex++}`);
    values.push(updates.longestStreak);
  }
  if (updates.starsEarned !== undefined) {
    fields.push(`stars_earned = $${paramIndex++}`);
    values.push(updates.starsEarned);
  }

  if (fields.length === 0) {
    return getById(id);
  }

  values.push(id);
  const query = `
    UPDATE playthrough_song_stats
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query<PlaythroughSongStats>(query, values);
  return result.rows[0] || null;
}

export async function getById(id: number): Promise<PlaythroughSongStats | null> {
  const result = await db.query<PlaythroughSongStats>(
    'SELECT * FROM playthrough_song_stats WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @bearded-nemesis/api test playthroughSongStatsRepository
```

Expected: PASS

**Step 5: Write failing test for PATCH endpoint**

Add to `apps/api/src/routes/playthroughs.test.ts`:

```typescript
describe('PATCH /playthroughs/:id/songs/:position/stats/:userId', () => {
  it('updates stats for a player', async () => {
    const user = await createTestUser();
    const token = await generateToken(user);

    const setlist = await setlistRepo.create({
      userId: user.id,
      name: 'Test',
      type: 'manual'
    });

    const playthrough = await playthroughRepo.create({
      setlistId: setlist.id,
      createdBy: user.id,
      status: 'finished'
    });

    await playthroughPlayerRepo.addPlayer({
      playthroughId: playthrough.id,
      userId: user.id,
      instrument: 'drums',
      difficulty: 'expert',
      isProMode: false
    });

    const song = await playthroughSongRepo.create({
      playthroughId: playthrough.id,
      songId: 1,
      position: 0
    });

    const stats = await playthroughSongStatsRepo.create({
      playthroughSongId: song.id,
      userId: user.id,
      score: 100000
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/playthroughs/${playthrough.id}/songs/0/stats/${user.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        score: 150000,
        accuracyPct: 99.5,
        starsEarned: 6
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.score).toBe(150000);
    expect(body.accuracyPct).toBe(99.5);
    expect(body.starsEarned).toBe(6);
  });

  it('validates stars earned range (1-6)', async () => {
    const user = await createTestUser();
    const token = await generateToken(user);

    const response = await app.inject({
      method: 'PATCH',
      url: `/playthroughs/1/songs/0/stats/${user.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { starsEarned: 7 }
    });

    expect(response.statusCode).toBe(400);
  });

  it('validates accuracy range (0-100)', async () => {
    const user = await createTestUser();
    const token = await generateToken(user);

    const response = await app.inject({
      method: 'PATCH',
      url: `/playthroughs/1/songs/0/stats/${user.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { accuracyPct: 150 }
    });

    expect(response.statusCode).toBe(400);
  });

  it('requires participant authorization', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser({ username: 'other' });
    const token2 = await generateToken(user2);

    const setlist = await setlistRepo.create({
      userId: user1.id,
      name: 'Test',
      type: 'manual'
    });

    const playthrough = await playthroughRepo.create({
      setlistId: setlist.id,
      createdBy: user1.id,
      status: 'finished'
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/playthroughs/${playthrough.id}/songs/0/stats/${user1.id}`,
      headers: { authorization: `Bearer ${token2}` },
      payload: { score: 150000 }
    });

    expect(response.statusCode).toBe(403);
  });
});
```

**Step 6: Run test to verify it fails**

```bash
pnpm --filter @bearded-nemesis/api test playthroughs
```

Expected: FAIL with 404 Not Found

**Step 7: Implement PATCH route**

Add to `apps/api/src/routes/playthroughs.ts`:

```typescript
const updateStatsSchema = z.object({
  score: z.number().optional(),
  accuracyPct: z.number().min(0).max(100).optional(),
  notesHit: z.number().min(0).optional(),
  notesMissed: z.number().min(0).optional(),
  longestStreak: z.number().min(0).optional(),
  starsEarned: z.number().min(1).max(6).optional()
});

const userIdSchema = z.object({
  userId: z.coerce.number()
});

// Update stats for a player on a song (for OCR correction)
app.patch('/:id/songs/:position/stats/:userId', async (request, reply) => {
  const { id } = playthroughIdSchema.parse(request.params);
  const { position } = positionSchema.parse(request.params);
  const { userId } = userIdSchema.parse(request.params);
  const updates = updateStatsSchema.parse(request.body);

  const playthrough = await playthroughRepo.findById(id);
  if (!playthrough) {
    return reply.status(404).send({ error: 'Playthrough not found' });
  }

  // Verify user is a participant
  const isParticipant = await playthroughService.isParticipant(id, request.user.userId);
  if (!isParticipant && !request.user.isAdmin) {
    return reply.status(403).send({ error: 'Must be a participant to edit stats' });
  }

  // Get the playthrough song
  const playthroughSong = await playthroughSongRepo.getSongAtPosition(id, position);
  if (!playthroughSong) {
    return reply.status(404).send({ error: 'Song not found at position' });
  }

  // Find existing stats record
  const stats = await playthroughSongStatsRepo.getForUserAndSong(userId, playthroughSong.id);
  if (!stats) {
    return reply.status(404).send({ error: 'Stats not found for this user and song' });
  }

  // Update the stats
  const updated = await playthroughSongStatsRepo.updateStats(stats.id, updates);

  return updated;
});
```

**Step 8: Run test to verify it passes**

```bash
pnpm --filter @bearded-nemesis/api test playthroughs
```

Expected: PASS

**Step 9: Commit**

```bash
git add apps/api/src/repositories/playthroughSongStatsRepository.ts apps/api/src/routes/playthroughs.ts apps/api/src/repositories/playthroughSongStatsRepository.test.ts apps/api/src/routes/playthroughs.test.ts
git commit -m "feat(api): add PATCH endpoint for updating OCR stats

Add endpoint to update playthrough song stats for OCR correction.
Validates ranges (stars 1-6, accuracy 0-100).
Requires participant authorization.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Frontend API Client Methods

**Files:**
- Modify: `apps/frontend/src/lib/api/playthroughs.ts`

**Step 1: Add getSummary method**

Add to `apps/frontend/src/lib/api/playthroughs.ts`:

```typescript
export interface PlaythroughSummary {
  playthrough: Playthrough;
  setlist: { id: number; name: string } | null;
  players: Array<{
    userId: number;
    username: string;
    displayName: string;
    instrument: Instrument;
    difficulty: Difficulty;
    isProMode: boolean;
  }>;
  songs: Array<{
    position: number;
    song: Song;
    screenshotPath: string | null;
    ocrStatus: 'completed' | 'pending' | 'failed' | null;
    ratings: Array<{
      userId: number;
      username: string;
      rating: number;
    }>;
    stats: Array<{
      userId: number;
      username: string;
      score: number | null;
      accuracyPct: number | null;
      notesHit: number | null;
      notesMissed: number | null;
      longestStreak: number | null;
      starsEarned: number | null;
    }>;
  }>;
}

export async function getPlaythroughSummary(id: number): Promise<PlaythroughSummary> {
  return apiRequest<PlaythroughSummary>(`/playthroughs/${id}/summary`, {
    authenticated: true,
  });
}
```

**Step 2: Add updateStats method**

Add to `apps/frontend/src/lib/api/playthroughs.ts`:

```typescript
export interface UpdateStatsRequest {
  score?: number;
  accuracyPct?: number;
  notesHit?: number;
  notesMissed?: number;
  longestStreak?: number;
  starsEarned?: number;
}

export async function updateStats(
  playthroughId: number,
  position: number,
  userId: number,
  updates: UpdateStatsRequest
): Promise<void> {
  await apiRequest(`/playthroughs/${playthroughId}/songs/${position}/stats/${userId}`, {
    method: 'PATCH',
    authenticated: true,
    body: JSON.stringify(updates),
  });
}
```

**Step 3: Commit**

```bash
git add apps/frontend/src/lib/api/playthroughs.ts
git commit -m "feat(frontend): add API client methods for summary and stats update

Add getSummary and updateStats methods to playthrough API client.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create PlaythroughSummaryHeader Component

**Files:**
- Create: `apps/frontend/src/lib/components/PlaythroughSummaryHeader.svelte`

**Step 1: Create component file**

Create `apps/frontend/src/lib/components/PlaythroughSummaryHeader.svelte`:

```svelte
<script lang="ts">
  import type { PlaythroughSummary } from '$lib/api/playthroughs';

  interface Props {
    summary: PlaythroughSummary;
  }

  let { summary }: Props = $props();

  // Calculate stats
  const totalSongs = $derived(summary.songs.length);
  const songsWithRatings = $derived(
    summary.songs.filter(s => s.ratings.length > 0).length
  );
  const songsWithOCR = $derived(
    summary.songs.filter(s => s.ocrStatus === 'completed').length
  );

  // Per-player stats
  const playerStats = $derived(
    summary.players.map(player => {
      const ratings = summary.songs
        .flatMap(s => s.ratings)
        .filter(r => r.userId === player.userId);

      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      return {
        username: player.username,
        instrument: player.instrument,
        avgRating: avgRating.toFixed(1),
        songsRated: ratings.length
      };
    })
  );
</script>

<div class="card mb-6">
  <h1 class="text-3xl font-bold mb-4">Playthrough Complete!</h1>

  {#if summary.setlist}
    <p class="text-xl text-gray-600 mb-4">{summary.setlist.name}</p>
  {/if}

  <div class="mb-4">
    <p class="text-sm text-gray-600">
      {totalSongs} songs • {songsWithRatings} rated • {songsWithOCR} with stats
    </p>
  </div>

  <div class="space-y-2">
    <h3 class="font-semibold mb-2">Players</h3>
    {#each playerStats as player}
      <div class="flex items-center gap-2 text-sm">
        <span class="font-medium">{player.username}</span>
        <span class="text-gray-500">({player.instrument})</span>
        {#if player.songsRated > 0}
          <span class="text-yellow-500">{player.avgRating}★ avg</span>
          <span class="text-gray-500">{player.songsRated}/{totalSongs} rated</span>
        {:else}
          <span class="text-gray-400">No ratings</span>
        {/if}
      </div>
    {/each}
  </div>
</div>
```

**Step 2: Commit**

```bash
git add apps/frontend/src/lib/components/PlaythroughSummaryHeader.svelte
git commit -m "feat(frontend): add PlaythroughSummaryHeader component

Display overall playthrough stats, setlist name, and per-player summaries.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create ScreenshotModal Component

**Files:**
- Create: `apps/frontend/src/lib/components/ScreenshotModal.svelte`

**Step 1: Create component file**

Create `apps/frontend/src/lib/components/ScreenshotModal.svelte`:

```svelte
<script lang="ts">
  import { toastStore } from '$lib/stores/toast';
  import * as playthroughsApi from '$lib/api/playthroughs';

  interface Props {
    screenshotPath: string;
    playthroughId: number;
    position: number;
    onClose: () => void;
    onRerunOCR?: () => void;
  }

  let { screenshotPath, playthroughId, position, onClose, onRerunOCR }: Props = $props();

  let rerunning = $state(false);

  async function handleRerunOCR() {
    rerunning = true;
    try {
      await playthroughsApi.retryOCR(playthroughId, position);
      toastStore.success('OCR retry started');
      onRerunOCR?.();
      onClose();
    } catch (err) {
      console.error('Failed to retry OCR:', err);
      toastStore.error('Failed to retry OCR');
    } finally {
      rerunning = false;
    }
  }
</script>

<!-- Modal overlay -->
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={onClose}>
  <!-- Modal content -->
  <div class="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto" onclick={(e) => e.stopPropagation()}>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Screenshot</h2>
      <button onclick={onClose} class="text-gray-500 hover:text-gray-700">✕</button>
    </div>

    <img src={screenshotPath} alt="Playthrough screenshot" class="max-w-full mb-4" />

    <div class="flex gap-2">
      {#if onRerunOCR}
        <button onclick={handleRerunOCR} class="btn btn-secondary" disabled={rerunning}>
          {rerunning ? 'Processing...' : 'Re-run OCR'}
        </button>
      {/if}
      <button onclick={onClose} class="btn btn-primary">Close</button>
    </div>
  </div>
</div>
```

**Step 2: Add retryOCR to API client**

Add to `apps/frontend/src/lib/api/playthroughs.ts`:

```typescript
export async function retryOCR(playthroughId: number, position: number): Promise<void> {
  await apiRequest(`/playthroughs/${playthroughId}/songs/${position}/retry-ocr`, {
    method: 'POST',
    authenticated: true,
  });
}
```

**Step 3: Commit**

```bash
git add apps/frontend/src/lib/components/ScreenshotModal.svelte apps/frontend/src/lib/api/playthroughs.ts
git commit -m "feat(frontend): add ScreenshotModal component

Display full-size screenshot with re-run OCR option.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create PlaythroughStatsEditor Component

**Files:**
- Create: `apps/frontend/src/lib/components/PlaythroughStatsEditor.svelte`

**Step 1: Create component file**

Create `apps/frontend/src/lib/components/PlaythroughStatsEditor.svelte`:

```svelte
<script lang="ts">
  import { toastStore } from '$lib/stores/toast';

  interface Stats {
    userId: number;
    username: string;
    score: number | null;
    accuracyPct: number | null;
    notesHit: number | null;
    notesMissed: number | null;
    longestStreak: number | null;
    starsEarned: number | null;
  }

  interface Props {
    stats: Stats;
    onSave: (updates: Partial<Stats>) => Promise<void>;
    onCancel: () => void;
  }

  let { stats, onSave, onCancel }: Props = $props();

  let score = $state(stats.score ?? '');
  let accuracyPct = $state(stats.accuracyPct ?? '');
  let notesHit = $state(stats.notesHit ?? '');
  let notesMissed = $state(stats.notesMissed ?? '');
  let longestStreak = $state(stats.longestStreak ?? '');
  let starsEarned = $state(stats.starsEarned ?? '');
  let saving = $state(false);

  async function handleSave() {
    saving = true;
    try {
      const updates: any = {};

      if (score !== '') updates.score = Number(score);
      if (accuracyPct !== '') {
        const pct = Number(accuracyPct);
        if (pct < 0 || pct > 100) {
          toastStore.error('Accuracy must be between 0 and 100');
          saving = false;
          return;
        }
        updates.accuracyPct = pct;
      }
      if (notesHit !== '') updates.notesHit = Number(notesHit);
      if (notesMissed !== '') updates.notesMissed = Number(notesMissed);
      if (longestStreak !== '') updates.longestStreak = Number(longestStreak);
      if (starsEarned !== '') {
        const stars = Number(starsEarned);
        if (stars < 1 || stars > 6) {
          toastStore.error('Stars must be between 1 and 6');
          saving = false;
          return;
        }
        updates.starsEarned = stars;
      }

      await onSave(updates);
      toastStore.success('Stats updated');
    } catch (err) {
      console.error('Failed to save stats:', err);
      toastStore.error('Failed to save stats');
    } finally {
      saving = false;
    }
  }
</script>

<div class="bg-gray-50 p-4 rounded-lg">
  <div class="font-medium mb-3">{stats.username}</div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="block text-xs text-gray-600 mb-1">Score</label>
      <input type="number" bind:value={score} class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Accuracy %</label>
      <input type="number" bind:value={accuracyPct} min="0" max="100" step="0.1" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Notes Hit</label>
      <input type="number" bind:value={notesHit} min="0" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Notes Missed</label>
      <input type="number" bind:value={notesMissed} min="0" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Longest Streak</label>
      <input type="number" bind:value={longestStreak} min="0" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Stars (1-6)</label>
      <input type="number" bind:value={starsEarned} min="1" max="6" class="input input-sm w-full" />
    </div>
  </div>

  <div class="flex gap-2 mt-4">
    <button onclick={handleSave} class="btn btn-primary btn-sm" disabled={saving}>
      {saving ? 'Saving...' : 'Save Changes'}
    </button>
    <button onclick={onCancel} class="btn btn-secondary btn-sm" disabled={saving}>
      Cancel
    </button>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add apps/frontend/src/lib/components/PlaythroughStatsEditor.svelte
git commit -m "feat(frontend): add PlaythroughStatsEditor component

Inline form for editing OCR stats with validation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create PlaythroughSongCard Component

**Files:**
- Create: `apps/frontend/src/lib/components/PlaythroughSongCard.svelte`

**Step 1: Create component file**

Create `apps/frontend/src/lib/components/PlaythroughSongCard.svelte`:

```svelte
<script lang="ts">
  import DifficultyBadge from './DifficultyBadge.svelte';
  import PlaythroughStatsEditor from './PlaythroughStatsEditor.svelte';
  import ScreenshotModal from './ScreenshotModal.svelte';
  import * as playthroughsApi from '$lib/api/playthroughs';
  import type { PlaythroughSummary } from '$lib/api/playthroughs';

  interface Props {
    songData: PlaythroughSummary['songs'][0];
    playthroughId: number;
    players: PlaythroughSummary['players'];
    onStatsUpdated?: () => void;
  }

  let { songData, playthroughId, players, onStatsUpdated }: Props = $props();

  let expanded = $state(false);
  let editingUserId = $state<number | null>(null);
  let showingScreenshot = $state(false);

  const avgRating = $derived(
    songData.ratings.length > 0
      ? (songData.ratings.reduce((sum, r) => sum + r.rating, 0) / songData.ratings.length).toFixed(1)
      : null
  );

  const ocrIcon = $derived(
    songData.ocrStatus === 'completed' ? '✓' :
    songData.ocrStatus === 'pending' || songData.ocrStatus === 'processing' ? '⚠️' :
    songData.ocrStatus === 'failed' ? '✗' :
    '○'
  );

  const ocrColor = $derived(
    songData.ocrStatus === 'completed' ? 'text-green-600' :
    songData.ocrStatus === 'pending' || songData.ocrStatus === 'processing' ? 'text-yellow-600' :
    songData.ocrStatus === 'failed' ? 'text-red-600' :
    'text-gray-400'
  );

  const hasIncompleteData = $derived(
    songData.ratings.length < players.length ||
    (songData.screenshotPath && songData.ocrStatus !== 'completed')
  );

  async function handleSaveStats(userId: number, updates: any) {
    await playthroughsApi.updateStats(playthroughId, songData.position, userId, updates);
    editingUserId = null;
    onStatsUpdated?.();
  }
</script>

<div
  class="card mb-4 cursor-pointer hover:bg-gray-50 transition-colors"
  class:border-l-4={hasIncompleteData}
  class:border-yellow-400={hasIncompleteData}
  onclick={() => expanded = !expanded}
>
  <div class="flex items-center gap-4">
    <!-- Album art -->
    {#if songData.song.coverArtUrl}
      <img
        src={songData.song.coverArtUrl}
        alt={songData.song.title}
        class="w-12 h-12 rounded object-cover flex-shrink-0"
      />
    {/if}

    <!-- Song info -->
    <div class="flex-1 min-w-0">
      <div class="font-bold truncate">{songData.song.title}</div>
      <div class="text-sm text-gray-600 truncate">{songData.song.artist}</div>
    </div>

    <!-- Summary stats -->
    <div class="flex items-center gap-4 text-sm flex-shrink-0">
      <span class="text-gray-600">{songData.ratings.length} players rated</span>
      {#if avgRating}
        <span class="text-yellow-500">Avg: {avgRating}★</span>
      {/if}
      <span class={ocrColor}>{ocrIcon}</span>
    </div>

    <!-- Chevron -->
    <div class="transform transition-transform flex-shrink-0" class:rotate-180={expanded}>
      ▼
    </div>
  </div>

  {#if expanded}
    <div class="mt-6 space-y-6" onclick={(e) => e.stopPropagation()}>
      <!-- Difficulty badges -->
      <div class="flex gap-2">
        <DifficultyBadge difficulty={songData.song.difficultyDrums} instrument="D" />
        <DifficultyBadge difficulty={songData.song.difficultyGuitar} instrument="G" />
        <DifficultyBadge difficulty={songData.song.difficultyBass} instrument="B" />
        <DifficultyBadge difficulty={songData.song.difficultyVocals} instrument="V" />
      </div>

      <!-- Players & Ratings -->
      <div>
        <h3 class="font-semibold mb-3">Players & Ratings</h3>
        <div class="grid grid-cols-2 gap-3">
          {#each players as player}
            {@const rating = songData.ratings.find(r => r.userId === player.userId)}
            <div class="bg-gray-50 p-3 rounded">
              <div class="font-medium">{player.username}</div>
              <div class="text-xs text-gray-600 mb-1">
                {player.instrument} • {player.difficulty}
              </div>
              {#if rating}
                <div class="text-yellow-500">{'★'.repeat(rating.rating)}</div>
              {:else}
                <div class="text-gray-400 text-sm">Not rated</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Performance Statistics -->
      {#if songData.stats.length > 0}
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Performance Statistics</h3>
            {#if editingUserId === null}
              <button
                class="btn btn-secondary btn-sm"
                onclick={(e) => { e.stopPropagation(); editingUserId = songData.stats[0]?.userId || null; }}
              >
                Edit Stats
              </button>
            {/if}
          </div>

          <div class="space-y-3">
            {#each songData.stats as stat}
              {#if editingUserId === stat.userId}
                <PlaythroughStatsEditor
                  {stat}
                  onSave={(updates) => handleSaveStats(stat.userId, updates)}
                  onCancel={() => editingUserId = null}
                />
              {:else}
                <div class="bg-gray-50 p-3 rounded">
                  <div class="font-medium mb-2">{stat.username}</div>
                  <div class="grid grid-cols-2 gap-2 text-sm">
                    {#if stat.score !== null}
                      <div>
                        <span class="text-gray-600">Score:</span>
                        <span class="ml-1 font-medium">{stat.score.toLocaleString()}</span>
                      </div>
                    {/if}
                    {#if stat.accuracyPct !== null}
                      <div>
                        <span class="text-gray-600">Accuracy:</span>
                        <span class="ml-1 font-medium">{stat.accuracyPct.toFixed(1)}%</span>
                      </div>
                    {/if}
                    {#if stat.starsEarned !== null}
                      <div>
                        <span class="text-gray-600">Stars:</span>
                        <span class="ml-1 text-yellow-500">{'★'.repeat(stat.starsEarned)}{'☆'.repeat(6 - stat.starsEarned)}</span>
                      </div>
                    {/if}
                    {#if stat.longestStreak !== null}
                      <div>
                        <span class="text-gray-600">Best Streak:</span>
                        <span class="ml-1 font-medium">{stat.longestStreak}</span>
                      </div>
                    {/if}
                    {#if stat.notesHit !== null}
                      <div>
                        <span class="text-gray-600">Notes Hit:</span>
                        <span class="ml-1 font-medium">{stat.notesHit}</span>
                      </div>
                    {/if}
                    {#if stat.notesMissed !== null}
                      <div>
                        <span class="text-gray-600">Notes Missed:</span>
                        <span class="ml-1 font-medium">{stat.notesMissed}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <div class="text-gray-500 text-sm">No stats captured</div>
      {/if}

      <!-- Screenshot & OCR -->
      <div>
        <h3 class="font-semibold mb-3">Screenshot & OCR</h3>
        {#if songData.screenshotPath}
          <button
            class="text-blue-600 hover:underline"
            onclick={(e) => { e.stopPropagation(); showingScreenshot = true; }}
          >
            Screenshot: <span class={ocrColor}>{ocrIcon}</span> View
          </button>
        {:else}
          <p class="text-gray-500 text-sm">No screenshot uploaded</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if showingScreenshot && songData.screenshotPath}
  <ScreenshotModal
    screenshotPath={songData.screenshotPath}
    {playthroughId}
    position={songData.position}
    onClose={() => showingScreenshot = false}
    onRerunOCR={onStatsUpdated}
  />
{/if}
```

**Step 2: Commit**

```bash
git add apps/frontend/src/lib/components/PlaythroughSongCard.svelte
git commit -m "feat(frontend): add PlaythroughSongCard component

Expandable song card showing ratings, stats, and screenshot viewer.
Supports inline editing of OCR stats.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update Playthrough Page

**Files:**
- Modify: `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte`

**Step 1: Add summary view to playthrough page**

Update the `isFinished` block in `apps/frontend/src/routes/(protected)/playthroughs/[id]/+page.svelte`:

```svelte
<script lang="ts">
  // ... existing imports
  import PlaythroughSummaryHeader from '$lib/components/PlaythroughSummaryHeader.svelte';
  import PlaythroughSongCard from '$lib/components/PlaythroughSongCard.svelte';
  import type { PlaythroughSummary } from '$lib/api/playthroughs';

  // ... existing code

  let summary = $state<PlaythroughSummary | null>(null);
  let loadingSummary = $state(false);

  async function loadSummary() {
    loadingSummary = true;
    try {
      summary = await playthroughsApi.getPlaythroughSummary(playthroughId);
    } catch (err) {
      console.error('Failed to load summary:', err);
      toastStore.error('Failed to load summary');
    } finally {
      loadingSummary = false;
    }
  }

  // Load summary when playthrough is finished
  $effect(() => {
    if (playthrough?.status === 'finished' && !summary && !loadingSummary) {
      loadSummary();
    }
  });
</script>

<!-- ... existing code ... -->

{#if isFinished}
  {#if loadingSummary}
    <div class="text-center py-12">
      <p class="text-gray-600">Loading summary...</p>
    </div>
  {:else if summary}
    <PlaythroughSummaryHeader {summary} />

    <div class="space-y-4">
      {#each summary.songs as songData}
        <PlaythroughSongCard
          {songData}
          {playthroughId}
          players={summary.players}
          onStatsUpdated={loadSummary}
        />
      {/each}
    </div>

    <div class="mt-6">
      <a href="/playthroughs" class="btn btn-primary">View All Playthroughs</a>
    </div>
  {:else}
    <div class="card text-center py-12">
      <h1 class="text-3xl font-bold mb-4">Playthrough Complete!</h1>
      <p class="text-gray-600 mb-6">Failed to load summary.</p>
      <button onclick={loadSummary} class="btn btn-secondary mr-2">Retry</button>
      <a href="/playthroughs" class="btn btn-primary">View All Playthroughs</a>
    </div>
  {/if}
{:else}
  <!-- ... existing active playthrough UI ... -->
{/if}
```

**Step 2: Test manually**

Run the dev server and test:

```bash
pnpm --filter @bearded-nemesis/frontend dev
```

1. Create a playthrough
2. Finish it
3. Verify summary loads
4. Expand song cards
5. Test editing stats
6. View screenshot

**Step 3: Commit**

```bash
git add apps/frontend/src/routes/\(protected\)/playthroughs/\[id\]/+page.svelte
git commit -m "feat(frontend): integrate summary view in playthrough page

Replace basic completion message with comprehensive summary.
Show expandable song cards with ratings and stats.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Run All Tests

**Step 1: Run API tests**

```bash
pnpm --filter @bearded-nemesis/api test
```

Expected: All tests pass

**Step 2: Run frontend type check**

```bash
pnpm --filter @bearded-nemesis/frontend check
```

Expected: No type errors

**Step 3: Build all packages**

```bash
pnpm build
```

Expected: Clean build

**Step 4: Commit if fixes needed**

If any issues found, fix and commit:

```bash
git add .
git commit -m "fix: resolve test/type issues

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] GET `/playthroughs/:id/summary` returns complete data
- [ ] PATCH `/playthroughs/:id/songs/:position/stats/:userId` updates stats
- [ ] Validation enforces stars 1-6, accuracy 0-100
- [ ] Access control requires participant/host
- [ ] Summary header shows overall stats
- [ ] Song cards expand/collapse correctly
- [ ] Stats editor validates input
- [ ] Screenshot modal displays and allows re-run OCR
- [ ] Incomplete songs show yellow border
- [ ] All tests pass
- [ ] No type errors
- [ ] Clean build

---

## Notes

**Gold stars:** Stars validation allows 1-6 to support gold star achievement.

**Performance:** Single `/summary` endpoint eliminates N API calls for 10-20 song setlists.

**Edit scope:** Each stats editor modifies one player's stats for one song. For multiple players, perform multiple edit operations.

**Missing data:** Components gracefully handle missing ratings, stats, and screenshots.
