<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as playthroughsApi from '$lib/api/playthroughs';
  import type { Playthrough } from '@bearded-nemesis/shared';
  import { toastStore } from '$lib/stores/toast';

  let playthroughs = $state<Playthrough[]>([]);
  let loading = $state(true);

  async function loadPlaythroughs() {
    loading = true;
    try {
      const result = await playthroughsApi.getPlaythroughs();
      playthroughs = result.playthroughs;
    } catch (err) {
      console.error('Failed to load playthroughs:', err);
      toastStore.error('Failed to load playthroughs');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadPlaythroughs();
  });

  function viewPlaythrough(playthrough: Playthrough) {
    goto(`/playthroughs/${playthrough.id}`);
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }
</script>

<div>
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold">Playthroughs</h1>
    <button onclick={() => goto('/playthroughs/new')} class="btn btn-primary">
      + New Playthrough
    </button>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Loading playthroughs...</p>
    </div>
  {:else if playthroughs.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-600 mb-4">No playthroughs yet</p>
      <p class="text-gray-500 text-sm">Start a playthrough from one of your setlists!</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each playthroughs as playthrough (playthrough.id)}
        <div
          class="card hover:shadow-lg transition-shadow cursor-pointer"
          role="button"
          tabindex="0"
          onclick={() => viewPlaythrough(playthrough)}
          onkeydown={(e) => e.key === 'Enter' && viewPlaythrough(playthrough)}
        >
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-bold text-lg">Playthrough #{playthrough.id}</h3>
              <p class="text-gray-600 text-sm">Started: {formatDate(playthrough.startedAt)}</p>
              {#if playthrough.finishedAt}
                <p class="text-gray-600 text-sm">Finished: {formatDate(playthrough.finishedAt)}</p>
              {/if}
            </div>
            <div class="text-right">
              <span class={`badge ${playthrough.status === 'in_progress' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {playthrough.status === 'in_progress' ? 'In Progress' : 'Finished'}
              </span>
              <p class="text-sm text-gray-600 mt-1">Position: {playthrough.currentPosition + 1}</p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
