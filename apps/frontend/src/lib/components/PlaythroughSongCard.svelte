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
    songData.ocrStatus === 'pending' ? '⚠️' :
    songData.ocrStatus === 'failed' ? '✗' :
    '○'
  );

  const ocrColor = $derived(
    songData.ocrStatus === 'completed' ? 'text-green-600' :
    songData.ocrStatus === 'pending' ? 'text-yellow-600' :
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
                  stats={stat}
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
