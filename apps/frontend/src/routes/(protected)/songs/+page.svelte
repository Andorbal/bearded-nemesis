<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as songsApi from '$lib/api/songs';
  import type { Song } from '@bearded-nemesis/shared';
  import SongCard from '$lib/components/SongCard.svelte';
  import { toastStore } from '$lib/stores/toast';

  let songs = $state<Song[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let minDifficulty = $state<number | undefined>(undefined);
  let maxDifficulty = $state<number | undefined>(undefined);
  let instrument = $state<string | undefined>(undefined);
  let total = $state(0);
  let offset = $state(0);
  const limit = 50;

  async function loadSongs() {
    loading = true;
    try {
      const result = await songsApi.searchSongs({
        q: searchQuery || undefined,
        minDifficulty,
        maxDifficulty,
        instrument,
        limit,
        offset,
      });
      songs = result.songs;
      total = result.total;
    } catch (err) {
      console.error('Failed to load songs:', err);
      toastStore.error('Failed to load songs');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadSongs();
  });

  function handleSearch() {
    offset = 0;
    loadSongs();
  }

  function handleNextPage() {
    if (offset + limit < total) {
      offset += limit;
      loadSongs();
    }
  }

  function handlePrevPage() {
    if (offset >= limit) {
      offset -= limit;
      loadSongs();
    }
  }

  function viewSong(song: Song) {
    goto(`/songs/${song.id}`);
  }
</script>

<div>
  <h1 class="text-3xl font-bold mb-6">Song Library</h1>

  <!-- Search and Filters -->
  <div class="card mb-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-2">
        <label for="search" class="block text-sm font-medium mb-2">Search</label>
        <input
          id="search"
          type="text"
          bind:value={searchQuery}
          class="input"
          placeholder="Search by title, artist..."
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      <div>
        <label for="instrument" class="block text-sm font-medium mb-2">Instrument</label>
        <select id="instrument" bind:value={instrument} class="input">
          <option value={undefined}>All</option>
          <option value="drums">Drums</option>
          <option value="guitar">Guitar</option>
          <option value="bass">Bass</option>
          <option value="vocals">Vocals</option>
        </select>
      </div>

      <div>
        <label for="difficulty" class="block text-sm font-medium mb-2">Difficulty</label>
        <div class="flex gap-2">
          <input
            type="number"
            bind:value={minDifficulty}
            class="input w-20"
            placeholder="Min"
            min="0"
            max="7"
          />
          <input
            type="number"
            bind:value={maxDifficulty}
            class="input w-20"
            placeholder="Max"
            min="0"
            max="7"
          />
        </div>
      </div>
    </div>

    <div class="mt-4">
      <button onclick={handleSearch} class="btn btn-primary">
        Search
      </button>
    </div>
  </div>

  <!-- Results -->
  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Loading songs...</p>
    </div>
  {:else if songs.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-600">No songs found</p>
    </div>
  {:else}
    <div class="mb-4 text-sm text-gray-600">
      Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} songs
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
      {#each songs as song (song.id)}
        <SongCard {song} onclick={() => viewSong(song)} />
      {/each}
    </div>

    <!-- Pagination -->
    <div class="flex justify-center gap-4">
      <button
        onclick={handlePrevPage}
        class="btn btn-secondary"
        disabled={offset === 0}
      >
        Previous
      </button>
      <button
        onclick={handleNextPage}
        class="btn btn-secondary"
        disabled={offset + limit >= total}
      >
        Next
      </button>
    </div>
  {/if}
</div>
