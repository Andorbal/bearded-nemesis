<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import * as setlistsApi from '$lib/api/setlists';
  import * as playthroughsApi from '$lib/api/playthroughs';
  import type { Setlist, Instrument, Difficulty } from '@bearded-nemesis/shared';
  import { INSTRUMENTS, DIFFICULTIES } from '@bearded-nemesis/shared';
  import { toastStore } from '$lib/stores/toast';

  let setlists = $state<Setlist[]>([]);
  let selectedSetlistId = $state<number | null>(null);
  let loading = $state(true);
  let creating = $state(false);

  interface Player {
    userId: number;
    instrument: Instrument;
    difficulty: Difficulty;
    proMode: boolean;
  }

  let players = $state<Player[]>([
    {
      userId: $authStore.user?.id ?? 0,
      instrument: 'drums',
      difficulty: 'expert',
      proMode: false,
    },
  ]);

  onMount(async () => {
    // Check for setlistId in query params
    const setlistIdParam = $page.url.searchParams.get('setlistId');
    if (setlistIdParam) {
      selectedSetlistId = parseInt(setlistIdParam);
    }

    try {
      const result = await setlistsApi.getSetlists();
      setlists = result.setlists;
    } catch (err) {
      console.error('Failed to load setlists:', err);
      toastStore.error('Failed to load setlists');
    } finally {
      loading = false;
    }
  });

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

  async function startPlaythrough() {
    if (!selectedSetlistId) {
      toastStore.error('Please select a setlist');
      return;
    }

    if (players.length === 0) {
      toastStore.error('Please add at least one player');
      return;
    }

    creating = true;
    try {
      const playthrough = await playthroughsApi.createPlaythrough({
        setlistId: selectedSetlistId,
        players,
      });
      toastStore.success('Playthrough started!');
      goto(`/playthroughs/${playthrough.id}`);
    } catch (err) {
      console.error('Failed to start playthrough:', err);
      toastStore.error('Failed to start playthrough');
    } finally {
      creating = false;
    }
  }
</script>

<div>
  <button onclick={() => goto('/playthroughs')} class="btn btn-secondary mb-4">
    &larr; Back to Playthroughs
  </button>

  <div class="card max-w-2xl">
    <h1 class="text-2xl font-bold mb-6">Start New Playthrough</h1>

    {#if loading}
      <p class="text-gray-600">Loading setlists...</p>
    {:else}
      <div class="space-y-6">
        <!-- Select Setlist -->
        <div>
          <label for="setlist" class="block text-sm font-medium mb-2">Select Setlist</label>
          <select
            id="setlist"
            bind:value={selectedSetlistId}
            class="input"
          >
            <option value={null}>-- Choose a setlist --</option>
            {#each setlists as setlist (setlist.id)}
              <option value={setlist.id}>{setlist.name}</option>
            {/each}
          </select>
        </div>

        <!-- Players -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold">Players</h2>
            <button onclick={addPlayer} class="btn btn-secondary btn-sm">
              + Add Player
            </button>
          </div>

          <div class="space-y-3">
            {#each players as player, index (index)}
              <div class="p-4 bg-gray-50 rounded">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium mb-1">Instrument</label>
                    <select bind:value={player.instrument} class="input input-sm">
                      {#each INSTRUMENTS as instrument}
                        <option value={instrument}>{instrument}</option>
                      {/each}
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium mb-1">Difficulty</label>
                    <select bind:value={player.difficulty} class="input input-sm">
                      {#each DIFFICULTIES as difficulty}
                        <option value={difficulty}>{difficulty}</option>
                      {/each}
                    </select>
                  </div>

                  <div class="col-span-2 flex items-center justify-between">
                    <label class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        bind:checked={player.proMode}
                        class="w-4 h-4"
                      />
                      <span class="text-sm">Pro Mode</span>
                    </label>

                    {#if players.length > 1}
                      <button
                        onclick={() => removePlayer(index)}
                        class="btn btn-danger btn-sm"
                      >
                        Remove
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <button
          onclick={startPlaythrough}
          class="btn btn-primary w-full"
          disabled={creating || !selectedSetlistId}
        >
          {creating ? 'Starting...' : 'Start Playthrough'}
        </button>
      </div>
    {/if}
  </div>
</div>
