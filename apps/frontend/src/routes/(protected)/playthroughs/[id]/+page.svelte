<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import * as playthroughsApi from '$lib/api/playthroughs';
  import { createWsPlaythroughService, type ConnectionStatus } from '$lib/services/wsPlaythroughService';
  import type { PlaythroughState, Song } from '@bearded-nemesis/shared';
  import type { PlaythroughSummary } from '$lib/api/playthroughs';
  import RatingStars from '$lib/components/RatingStars.svelte';
  import DifficultyBadge from '$lib/components/DifficultyBadge.svelte';
  import PlaythroughSummaryHeader from '$lib/components/PlaythroughSummaryHeader.svelte';
  import PlaythroughSongCard from '$lib/components/PlaythroughSongCard.svelte';
  import { toastStore } from '$lib/stores/toast';

  let loading = $state(true);
  let playthrough = $state<playthroughsApi.PlaythroughWithDetails | null>(null);

  // WebSocket state
  let wsService = $state<ReturnType<typeof createWsPlaythroughService> | null>(null);
  let connectionStatus = $state<ConnectionStatus>('disconnected');
  let currentState = $state<PlaythroughState | null>(null);
  let lastError = $state<string | null>(null);

  // Rating state
  let myRating = $state<number | null>(null);

  // Summary state
  let summary = $state<PlaythroughSummary | null>(null);
  let loadingSummary = $state(false);

  const playthroughId = $derived(parseInt($page.params.id || '0'));
  const isHost = $derived(playthrough?.createdBy === $authStore.user?.id);
  const isFinished = $derived(playthrough?.status === 'finished');

  // Screenshot upload
  let fileInput: HTMLInputElement;
  let uploading = $state(false);

  async function loadPlaythrough() {
    loading = true;
    try {
      playthrough = await playthroughsApi.getPlaythrough(playthroughId);
    } catch (err) {
      console.error('Failed to load playthrough:', err);
      toastStore.error('Failed to load playthrough');
    } finally {
      loading = false;
    }
  }

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

  function connectWebSocket() {
    if (!$authStore.accessToken) return;

    wsService = createWsPlaythroughService(playthroughId, $authStore.accessToken);

    // Subscribe to stores
    wsService.connectionStatus.subscribe(status => {
      connectionStatus = status;
    });

    wsService.currentState.subscribe(state => {
      currentState = state;
      // Reset my rating when song changes
      if (state && myRating !== null) {
        const myUsername = $authStore.user?.username || '';
        if (!state.ratingsThisSong[myUsername]) {
          myRating = null;
        }
      }
    });

    wsService.lastError.subscribe(error => {
      lastError = error;
    });

    wsService.screenshotUploaded.subscribe(event => {
      if (event) {
        console.log('Screenshot uploaded event. Status:', playthrough?.status);
        // Don't reload summary here - the optimistic update in handleFileUpload already set status to 'pending'
        // We'll reload when OCR completes
      }
    });

    wsService.ocrCompleted.subscribe(event => {
      if (event) {
        console.log('OCR completed event, reloading data. Status:', playthrough?.status, 'Players matched:', event.playersMatched);
        // Load summary to get the latest stats/OCR data without disrupting UI
        loadSummary();
      }
    });

    wsService.connect();
  }

  onMount(() => {
    loadPlaythrough();
    loadSummary(); // Load summary for all playthroughs to show existing OCR data
    connectWebSocket();

    // Handle visibility change (screen wake)
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onDestroy(() => {
    wsService?.disconnect();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && wsService) {
      wsService.reconnect();
    }
  }

  async function submitRating(rating: number) {
    if (!wsService) return;
    myRating = rating;
    wsService.submitRating(rating);
    toastStore.success(`Rating submitted: ${rating}`);
  }

  async function advanceSong() {
    try {
      await playthroughsApi.advanceSong(playthroughId);
    } catch (err) {
      console.error('Failed to advance song:', err);
      toastStore.error('Failed to advance song');
    }
  }

  async function previousSong() {
    try {
      await playthroughsApi.previousSong(playthroughId);
    } catch (err) {
      console.error('Failed to go back:', err);
      toastStore.error('Failed to go back');
    }
  }

  async function finishPlaythrough() {
    if (!confirm('Finish this playthrough?')) return;
    try {
      await playthroughsApi.finishPlaythrough(playthroughId);
      toastStore.success('Playthrough finished!');
      loadPlaythrough();
    } catch (err) {
      console.error('Failed to finish playthrough:', err);
      toastStore.error('Failed to finish playthrough');
    }
  }

  function triggerFileUpload() {
    fileInput?.click();
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !currentState) return;

    const currentPosition = currentState.currentPosition;
    uploading = true;
    try {
      await playthroughsApi.uploadScreenshot(playthroughId, currentPosition, file);

      // Optimistically update UI to show "Processing" and clear old stats
      if (summary) {
        summary = {
          ...summary,
          songs: summary.songs.map(song =>
            song.position === currentPosition
              ? { ...song, ocrStatus: 'pending', stats: [], screenshotPath: song.screenshotPath || 'uploading' }
              : song
          )
        };
      }
    } catch (err) {
      console.error('Failed to upload screenshot:', err);
      toastStore.error('Failed to upload screenshot');
    } finally {
      uploading = false;
      target.value = '';
    }
  }
</script>

<div>
  <button onclick={() => goto('/playthroughs')} class="btn btn-secondary mb-4">
    &larr; Back to Playthroughs
  </button>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Loading...</p>
    </div>
  {:else if !playthrough}
    <div class="text-center py-12">
      <p class="text-gray-600">Playthrough not found</p>
    </div>
  {:else if isFinished}
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
    <!-- Connection Status -->
    <div class="mb-4 flex items-center gap-2">
      <span class={`inline-block w-3 h-3 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500' :
        connectionStatus === 'connecting' ? 'bg-yellow-500' :
        'bg-red-500'
      }`}></span>
      <span class="text-sm text-gray-600">
        {connectionStatus === 'connected' ? 'Connected' :
         connectionStatus === 'connecting' ? 'Connecting...' :
         'Disconnected'}
      </span>
      {#if connectionStatus === 'disconnected'}
        <button onclick={() => wsService?.reconnect()} class="btn btn-secondary btn-sm">
          Reconnect
        </button>
      {/if}
    </div>

    {#if lastError}
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        {lastError}
      </div>
    {/if}

    {#if currentState}
      <!-- Current Song -->
      <div class="card mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <span class="text-sm text-gray-500">
              Song {currentState.currentPosition + 1} of {currentState.songs.length}
            </span>
          </div>
          <div class="flex gap-2">
            {#if currentState.players.length > 0}
              <span class="text-sm text-gray-500">
                Players: {currentState.players.join(', ')}
              </span>
            {/if}
          </div>
        </div>

        <div class="text-center py-8">
          {#if currentState.currentSong.coverArtUrl}
            <img
              src={currentState.currentSong.coverArtUrl}
              alt={currentState.currentSong.title}
              class="w-48 h-48 mx-auto rounded-lg shadow-lg mb-4 object-cover"
            />
          {/if}
          <h2 class="text-3xl font-bold mb-2">{currentState.currentSong.title}</h2>
          <p class="text-xl text-gray-600 mb-4">{currentState.currentSong.artist}</p>

          <div class="flex justify-center gap-2 mb-4">
            <DifficultyBadge difficulty={currentState.currentSong.difficultyDrums} instrument="D" />
            <DifficultyBadge difficulty={currentState.currentSong.difficultyGuitar} instrument="G" />
            <DifficultyBadge difficulty={currentState.currentSong.difficultyBass} instrument="B" />
            <DifficultyBadge difficulty={currentState.currentSong.difficultyVocals} instrument="V" />
          </div>
        </div>

        <!-- Ratings This Song -->
        {#if Object.keys(currentState.ratingsThisSong).length > 0}
          <div class="border-t pt-4">
            <h3 class="font-semibold mb-2">Ratings</h3>
            <div class="flex flex-wrap gap-4">
              {#each Object.entries(currentState.ratingsThisSong) as [user, rating]}
                <div class="text-sm">
                  <span class="font-medium">{user}:</span>
                  <span class="text-yellow-500">{'*'.repeat(rating)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- My Rating -->
      <div class="card mb-6">
        <h3 class="font-semibold mb-4">Rate This Song</h3>
        <div class="flex justify-center">
          <RatingStars
            rating={myRating}
            interactive={true}
            onRate={submitRating}
          />
        </div>
      </div>

      <!-- Screenshot Upload -->
      <div class="card mb-6">
        <h3 class="font-semibold mb-4">Upload Screenshot</h3>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          bind:this={fileInput}
          onchange={handleFileUpload}
          class="hidden"
        />
        <button
          onclick={triggerFileUpload}
          class="btn btn-secondary w-full"
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Take/Upload Screenshot'}
        </button>

        <!-- OCR Stats for Current Song -->
        {#if summary}
          {@const currentSongData = summary.songs.find(s => s.position === currentState?.currentPosition)}
          {#if currentSongData && currentSongData.screenshotPath}
            <div class="mt-4 pt-4 border-t">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-sm">OCR Results</h4>
                <span class={
                  currentSongData.ocrStatus === 'completed' ? 'text-green-600' :
                  currentSongData.ocrStatus === 'pending' ? 'text-yellow-600' :
                  currentSongData.ocrStatus === 'failed' ? 'text-red-600' :
                  'text-gray-400'
                }>
                  {currentSongData.ocrStatus === 'completed' ? '✓ Completed' :
                   currentSongData.ocrStatus === 'pending' ? '⚠️ Processing...' :
                   currentSongData.ocrStatus === 'failed' ? '✗ Failed' :
                   'No screenshot'}
                </span>
              </div>

              {#if currentSongData.stats.length > 0}
                <div class="space-y-2">
                  {#each currentSongData.stats as stat}
                    <div class="bg-gray-50 p-2 rounded text-sm">
                      <div class="font-medium mb-1">{stat.username}</div>
                      <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {#if stat.score !== null}
                          <div><span class="text-gray-600">Score:</span> {stat.score.toLocaleString()}</div>
                        {/if}
                        {#if stat.accuracyPct !== null}
                          <div><span class="text-gray-600">Accuracy:</span> {stat.accuracyPct.toFixed(1)}%</div>
                        {/if}
                        {#if stat.starsEarned !== null}
                          <div><span class="text-gray-600">Stars:</span> {'★'.repeat(stat.starsEarned)}</div>
                        {/if}
                        {#if stat.longestStreak !== null}
                          <div><span class="text-gray-600">Streak:</span> {stat.longestStreak}</div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else if currentSongData.ocrStatus === 'completed'}
                <p class="text-sm text-gray-500">No players matched</p>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Host Controls -->
      {#if isHost}
        <div class="card">
          <h3 class="font-semibold mb-4">Host Controls</h3>
          <div class="flex gap-2">
            <button
              onclick={previousSong}
              class="btn btn-secondary flex-1"
              disabled={currentState.currentPosition === 0}
            >
              &larr; Previous
            </button>
            <button
              onclick={advanceSong}
              class="btn btn-primary flex-1"
              disabled={currentState.currentPosition >= currentState.songs.length - 1}
            >
              Next &rarr;
            </button>
          </div>
          <button
            onclick={finishPlaythrough}
            class="btn btn-danger w-full mt-4"
          >
            Finish Playthrough
          </button>
        </div>
      {/if}
    {:else}
      <div class="text-center py-12">
        <p class="text-gray-600">Waiting for playthrough state...</p>
      </div>
    {/if}
  {/if}
</div>
