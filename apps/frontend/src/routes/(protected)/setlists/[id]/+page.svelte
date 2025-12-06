<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import * as setlistsApi from '$lib/api/setlists';
  import * as songsApi from '$lib/api/songs';
  import type { Setlist, Song } from '@bearded-nemesis/shared';
  import type { SetlistSongItem } from '$lib/api/setlists';
  import SongCard from '$lib/components/SongCard.svelte';
  import { toastStore } from '$lib/stores/toast';

  let setlist = $state<Setlist | null>(null);
  let songs = $state<SetlistSongItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let searchResults = $state<Song[]>([]);
  let searching = $state(false);

  const setlistId = $derived(parseInt($page.params.id || '0'));

  async function loadSetlist() {
    loading = true;
    try {
      setlist = await setlistsApi.getSetlist(setlistId);
      songs = await setlistsApi.getSetlistSongs(setlistId);
    } catch (err) {
      console.error('Failed to load setlist:', err);
      toastStore.error('Failed to load setlist');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadSetlist();
  });

  async function searchSongs() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    searching = true;
    try {
      const result = await songsApi.searchSongs({ q: searchQuery, limit: 20 });
      searchResults = result.songs;
    } catch (err) {
      console.error('Failed to search songs:', err);
      toastStore.error('Failed to search songs');
    } finally {
      searching = false;
    }
  }

  async function addSong(song: Song) {
    try {
      songs = await setlistsApi.addSongsToSetlist(setlistId, [song.id]);
      toastStore.success(`Added "${song.title}"`);
      searchQuery = '';
      searchResults = [];
    } catch (err) {
      console.error('Failed to add song:', err);
      toastStore.error('Failed to add song');
    }
  }

  async function removeSong(songId: number) {
    try {
      songs = await setlistsApi.removeSongFromSetlist(setlistId, songId);
      toastStore.success('Song removed');
    } catch (err) {
      console.error('Failed to remove song:', err);
      toastStore.error('Failed to remove song');
    }
  }

  async function moveUp(index: number) {
    if (index <= 0) return;
    const songIds = songs.map(s => s.songId);
    [songIds[index], songIds[index - 1]] = [songIds[index - 1], songIds[index]];
    try {
      songs = await setlistsApi.reorderSetlistSongs(setlistId, songIds);
    } catch (err) {
      console.error('Failed to reorder songs:', err);
      toastStore.error('Failed to reorder songs');
    }
  }

  async function moveDown(index: number) {
    if (index >= songs.length - 1) return;
    const songIds = songs.map(s => s.songId);
    [songIds[index], songIds[index + 1]] = [songIds[index + 1], songIds[index]];
    try {
      songs = await setlistsApi.reorderSetlistSongs(setlistId, songIds);
    } catch (err) {
      console.error('Failed to reorder songs:', err);
      toastStore.error('Failed to reorder songs');
    }
  }

  function startPlaythrough() {
    goto(`/playthroughs/new?setlistId=${setlistId}`);
  }
</script>

{#if loading}
  <div class="text-center py-12">
    <p class="text-gray-600">Loading...</p>
  </div>
{:else if !setlist}
  <div class="text-center py-12">
    <p class="text-gray-600">Setlist not found</p>
  </div>
{:else}
  <div>
    <button onclick={() => goto('/setlists')} class="btn btn-secondary mb-4">
      &larr; Back to Setlists
    </button>

    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold">{setlist.name}</h1>
      <button onclick={startPlaythrough} class="btn btn-primary">
        Start Playthrough
      </button>
    </div>

    {#if setlist.type === 'manual'}
      <!-- Add Songs Section -->
      <div class="card mb-6">
        <h2 class="text-xl font-semibold mb-4">Add Songs</h2>
        <div class="flex gap-2 mb-4">
          <input
            type="text"
            bind:value={searchQuery}
            class="input flex-1"
            placeholder="Search for songs..."
            onkeydown={(e) => e.key === 'Enter' && searchSongs()}
          />
          <button onclick={searchSongs} class="btn btn-primary" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {#if searchResults.length > 0}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each searchResults as song (song.id)}
              <div class="relative">
                <SongCard {song} />
                <button
                  onclick={() => addSong(song)}
                  class="absolute top-2 right-2 btn btn-primary btn-sm"
                >
                  + Add
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Setlist Songs -->
    <div class="card">
      <h2 class="text-xl font-semibold mb-4">Songs ({songs.length})</h2>

      {#if songs.length === 0}
        <p class="text-gray-600">No songs in this setlist yet</p>
      {:else}
        <div class="space-y-2">
          {#each songs as item, index (item.songId)}
            <div class="flex items-center gap-4 p-3 bg-gray-50 rounded">
              <span class="text-gray-600 font-bold w-8">{index + 1}</span>
              <div class="flex-1">
                <p class="font-semibold">{item.song.title}</p>
                <p class="text-sm text-gray-600">{item.song.artist}</p>
              </div>
              {#if setlist.type === 'manual'}
                <div class="flex gap-1">
                  <button
                    onclick={() => moveUp(index)}
                    class="btn btn-secondary btn-sm"
                    disabled={index === 0}
                  >
                    &uarr;
                  </button>
                  <button
                    onclick={() => moveDown(index)}
                    class="btn btn-secondary btn-sm"
                    disabled={index === songs.length - 1}
                  >
                    &darr;
                  </button>
                  <button
                    onclick={() => removeSong(item.songId)}
                    class="btn btn-danger btn-sm"
                  >
                    Remove
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
