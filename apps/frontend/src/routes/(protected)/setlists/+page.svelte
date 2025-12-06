<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as setlistsApi from '$lib/api/setlists';
  import type { Setlist } from '@bearded-nemesis/shared';
  import SetlistCard from '$lib/components/SetlistCard.svelte';
  import { toastStore } from '$lib/stores/toast';

  let setlists = $state<Setlist[]>([]);
  let loading = $state(true);

  async function loadSetlists() {
    loading = true;
    try {
      const result = await setlistsApi.getSetlists();
      setlists = result.setlists;
    } catch (err) {
      console.error('Failed to load setlists:', err);
      toastStore.error('Failed to load setlists');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadSetlists();
  });

  function viewSetlist(setlist: Setlist) {
    goto(`/setlists/${setlist.id}`);
  }

  async function deleteSetlist(setlist: Setlist) {
    if (!confirm(`Delete setlist "${setlist.name}"?`)) return;

    try {
      await setlistsApi.deleteSetlist(setlist.id);
      toastStore.success('Setlist deleted');
      loadSetlists();
    } catch (err) {
      console.error('Failed to delete setlist:', err);
      toastStore.error('Failed to delete setlist');
    }
  }
</script>

<div>
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold">Setlists</h1>
    <div class="flex gap-2">
      <button onclick={() => goto('/setlists/new')} class="btn btn-primary">
        + Manual Setlist
      </button>
      <button onclick={() => goto('/setlists/smart/new')} class="btn btn-primary">
        + Smart Setlist
      </button>
      <button onclick={() => goto('/setlists/builder')} class="btn btn-primary">
        LP Builder
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Loading setlists...</p>
    </div>
  {:else if setlists.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-600 mb-4">No setlists yet</p>
      <p class="text-gray-500 text-sm">Create your first setlist to get started!</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each setlists as setlist (setlist.id)}
        <SetlistCard
          {setlist}
          onclick={() => viewSetlist(setlist)}
          onDelete={() => deleteSetlist(setlist)}
        />
      {/each}
    </div>
  {/if}
</div>
