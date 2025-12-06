<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import * as setlistsApi from '$lib/api/setlists';
  import type { Song, Instrument, Difficulty } from '@bearded-nemesis/shared';
  import { INSTRUMENTS, DIFFICULTIES } from '@bearded-nemesis/shared';
  import { toastStore } from '$lib/stores/toast';

  interface Player {
    userId: number;
    instrument: Instrument;
    difficulty: Difficulty;
    proMode: boolean;
  }

  let name = $state('');
  let players = $state<Player[]>([
    {
      userId: $authStore.user?.id ?? 0,
      instrument: 'drums',
      difficulty: 'expert',
      proMode: false,
    },
  ]);
  let objective = $state<'play_rating' | 'song_rating' | 'discovery' | 'combined'>('combined');
  let ratingAggregation = $state<'average' | 'minimum' | 'maximum'>('average');

  // Constraints
  let songCountMin = $state<number>(10);
  let songCountMax = $state<number>(25);
  let maxDurationMinutes = $state<number | undefined>(undefined);
  let difficultyMin = $state<number | undefined>(undefined);
  let difficultyMax = $state<number | undefined>(undefined);

  let loading = $state(false);
  let results = $state<Song[] | null>(null);
  let resultStats = $state<{avgPlayRating: number; avgSongRating: number; avgDifficulty: number; unplayedCount: number} | null>(null);

  function addPlayer() {
    players = [...players, {
      userId: $authStore.user?.id ?? 0,
      instrument: 'guitar',
      difficulty: 'expert',
      proMode: false,
    }];
  }

  function removePlayer(index: number) {
    players = players.filter((_, i) => i !== index);
  }

  async function generateSetlist() {
    if (players.length === 0) {
      toastStore.error('Please add at least one player');
      return;
    }

    loading = true;
    results = null;
    resultStats = null;

    try {
      const response = await setlistsApi.lpSolve({
        players,
        objective,
        ratingAggregation,
        constraints: {
          songCountMin,
          songCountMax,
          maxDurationMinutes,
          difficultyMin,
          difficultyMax,
        },
      });
      results = response.songs;
      resultStats = response.stats;
      toastStore.success(`Generated setlist with ${response.songs.length} songs!`);
    } catch (err) {
      console.error('Failed to generate setlist:', err);
      toastStore.error('Failed to generate optimized setlist');
    } finally {
      loading = false;
    }
  }

  async function saveSetlist() {
    if (!results || !name.trim()) {
      toastStore.error('Please enter a name and generate a setlist first');
      return;
    }

    loading = true;
    try {
      const setlist = await setlistsApi.createSetlist({
        name: name.trim(),
        type: 'builder',
        builderPreset: {
          name: name.trim(),
          players,
          objective,
          ratingAggregation,
          constraints: {
            songCountMin,
            songCountMax,
            maxDurationMinutes,
            difficultyMin,
            difficultyMax,
          },
        },
      });

      // Add the songs
      await setlistsApi.addSongsToSetlist(setlist.id, results.map(s => s.id));

      toastStore.success('Setlist saved!');
      goto(`/setlists/${setlist.id}`);
    } catch (err) {
      console.error('Failed to save setlist:', err);
      toastStore.error('Failed to save setlist');
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <button onclick={() => goto('/setlists')} class="btn btn-secondary mb-4">
    &larr; Back to Setlists
  </button>

  <h1 class="text-3xl font-bold mb-6">LP Setlist Builder</h1>
  <p class="text-gray-600 mb-6">Uses linear programming to optimize your setlist based on player preferences and constraints.</p>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Left: Configuration -->
    <div class="space-y-6">
      <!-- Players -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">Players</h2>
          <button onclick={addPlayer} class="btn btn-secondary btn-sm">
            + Add Player
          </button>
        </div>

        <div class="space-y-3">
          {#each players as player, index (index)}
            <div class="p-3 bg-gray-50 rounded">
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-xs font-medium mb-1">Instrument</label>
                  <select bind:value={player.instrument} class="input input-sm">
                    {#each INSTRUMENTS as instrument}
                      <option value={instrument}>{instrument}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium mb-1">Difficulty</label>
                  <select bind:value={player.difficulty} class="input input-sm">
                    {#each DIFFICULTIES as difficulty}
                      <option value={difficulty}>{difficulty}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex items-end">
                  <button
                    onclick={() => removePlayer(index)}
                    class="btn btn-danger btn-sm"
                    disabled={players.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Optimization Settings -->
      <div class="card">
        <h2 class="text-xl font-semibold mb-4">Optimization</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Objective</label>
            <select bind:value={objective} class="input">
              <option value="combined">Combined (balanced)</option>
              <option value="play_rating">Maximize Play Rating</option>
              <option value="song_rating">Maximize Song Rating</option>
              <option value="discovery">Maximize Discovery (unplayed songs)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Rating Aggregation</label>
            <select bind:value={ratingAggregation} class="input">
              <option value="average">Average across players</option>
              <option value="minimum">Minimum (fairness)</option>
              <option value="maximum">Maximum</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Constraints -->
      <div class="card">
        <h2 class="text-xl font-semibold mb-4">Constraints</h2>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Min Songs</label>
              <input type="number" bind:value={songCountMin} class="input" min="1" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Max Songs</label>
              <input type="number" bind:value={songCountMax} class="input" min="1" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Max Duration (minutes)</label>
            <input type="number" bind:value={maxDurationMinutes} class="input" placeholder="No limit" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Min Difficulty</label>
              <input type="number" bind:value={difficultyMin} class="input" min="0" max="7" placeholder="0-7" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Max Difficulty</label>
              <input type="number" bind:value={difficultyMax} class="input" min="0" max="7" placeholder="0-7" />
            </div>
          </div>
        </div>
      </div>

      <button onclick={generateSetlist} class="btn btn-primary w-full" disabled={loading}>
        {loading ? 'Generating...' : 'Generate Optimized Setlist'}
      </button>
    </div>

    <!-- Right: Results -->
    <div class="card">
      <h2 class="text-xl font-semibold mb-4">Results</h2>

      {#if !results}
        <p class="text-gray-600">Configure your players and constraints, then click "Generate" to create an optimized setlist.</p>
      {:else if results.length === 0}
        <p class="text-gray-600">No songs matched your criteria. Try relaxing some constraints.</p>
      {:else}
        {#if resultStats}
          <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
            <div class="p-2 bg-gray-50 rounded">
              <span class="text-gray-600">Avg Play Rating:</span>
              <span class="font-semibold">{resultStats.avgPlayRating.toFixed(2)}</span>
            </div>
            <div class="p-2 bg-gray-50 rounded">
              <span class="text-gray-600">Avg Song Rating:</span>
              <span class="font-semibold">{resultStats.avgSongRating.toFixed(2)}</span>
            </div>
            <div class="p-2 bg-gray-50 rounded">
              <span class="text-gray-600">Avg Difficulty:</span>
              <span class="font-semibold">{resultStats.avgDifficulty.toFixed(1)}</span>
            </div>
            <div class="p-2 bg-gray-50 rounded">
              <span class="text-gray-600">Unplayed Songs:</span>
              <span class="font-semibold">{resultStats.unplayedCount}</span>
            </div>
          </div>
        {/if}

        <div class="space-y-2 mb-4 max-h-96 overflow-y-auto">
          {#each results as song, index (song.id)}
            <div class="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
              <span class="text-gray-500 w-6">{index + 1}.</span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold truncate">{song.title}</p>
                <p class="text-gray-600 text-xs truncate">{song.artist}</p>
              </div>
            </div>
          {/each}
        </div>

        <div class="border-t pt-4">
          <div class="mb-3">
            <label class="block text-sm font-medium mb-2">Setlist Name</label>
            <input type="text" bind:value={name} class="input" placeholder="My Optimized Setlist" />
          </div>
          <button onclick={saveSetlist} class="btn btn-primary w-full" disabled={loading || !name.trim()}>
            Save Setlist
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
