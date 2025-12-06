<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import * as songsApi from '$lib/api/songs';
  import type { Song, UserSong } from '@bearded-nemesis/shared';
  import DifficultyBadge from '$lib/components/DifficultyBadge.svelte';
  import RatingStars from '$lib/components/RatingStars.svelte';
  import { toastStore } from '$lib/stores/toast';

  let song = $state<Song | null>(null);
  let userSong = $state<UserSong | null>(null);
  let loading = $state(true);

  const songId = $derived(parseInt($page.params.id || '0'));

  async function loadSong() {
    loading = true;
    try {
      song = await songsApi.getSong(songId);
      try {
        userSong = await songsApi.getUserSong(songId);
      } catch {
        // User song data might not exist yet
        userSong = { userId: 0, songId, owned: false, songRating: null };
      }
    } catch (err) {
      console.error('Failed to load song:', err);
      toastStore.error('Failed to load song');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadSong();
  });

  async function toggleOwnership() {
    if (!userSong) return;
    try {
      userSong = await songsApi.setOwned(songId, !userSong.owned);
      toastStore.success(userSong.owned ? 'Marked as owned' : 'Marked as not owned');
    } catch (err) {
      console.error('Failed to update ownership:', err);
      toastStore.error('Failed to update ownership');
    }
  }

  async function handleRating(rating: number) {
    try {
      userSong = await songsApi.setSongRating(songId, rating);
      toastStore.success('Rating saved!');
    } catch (err) {
      console.error('Failed to save rating:', err);
      toastStore.error('Failed to save rating');
    }
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
</script>

{#if loading}
  <div class="text-center py-12">
    <p class="text-gray-600">Loading...</p>
  </div>
{:else if !song}
  <div class="text-center py-12">
    <p class="text-gray-600">Song not found</p>
    <button onclick={() => goto('/songs')} class="btn btn-primary mt-4">
      Back to Songs
    </button>
  </div>
{:else}
  <div>
    <button onclick={() => goto('/songs')} class="btn btn-secondary mb-4">
      &larr; Back to Songs
    </button>

    <div class="card">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Cover Art -->
        <div>
          {#if song.coverArtUrl}
            <img
              src={song.coverArtUrl}
              alt={`${song.title} cover`}
              class="w-full rounded-lg shadow"
            />
          {:else}
            <div class="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
              <span class="text-gray-400 text-6xl">&#9835;</span>
            </div>
          {/if}
        </div>

        <!-- Song Info -->
        <div class="md:col-span-2">
          <h1 class="text-3xl font-bold mb-2">{song.title}</h1>
          <p class="text-xl text-gray-700 mb-4">{song.artist}</p>

          {#if song.album}
            <p class="text-gray-600 mb-2">Album: {song.album}</p>
          {/if}

          {#if song.year}
            <p class="text-gray-600 mb-2">Year: {song.year}</p>
          {/if}

          {#if song.genre}
            <p class="text-gray-600 mb-2">Genre: {song.genre}</p>
          {/if}

          {#if song.durationMs}
            <p class="text-gray-600 mb-4">
              Duration: {formatDuration(song.durationMs)}
            </p>
          {/if}

          <!-- Difficulties -->
          <div class="mb-6">
            <h2 class="text-lg font-semibold mb-2">Difficulties</h2>
            <div class="flex flex-wrap gap-2">
              <DifficultyBadge difficulty={song.difficultyDrums} instrument="Drums" />
              <DifficultyBadge difficulty={song.difficultyGuitar} instrument="Guitar" />
              <DifficultyBadge difficulty={song.difficultyBass} instrument="Bass" />
              <DifficultyBadge difficulty={song.difficultyVocals} instrument="Vocals" />
            </div>
          </div>

          <!-- Ownership -->
          {#if userSong}
            <div class="mb-6">
              <h2 class="text-lg font-semibold mb-2">Ownership</h2>
              <button
                onclick={toggleOwnership}
                class={`btn ${userSong.owned ? 'btn-primary' : 'btn-secondary'}`}
              >
                {userSong.owned ? 'Owned' : 'Mark as Owned'}
              </button>
            </div>

            <!-- Song Rating -->
            <div>
              <h2 class="text-lg font-semibold mb-2">Your Rating</h2>
              <RatingStars
                rating={userSong.songRating}
                interactive={true}
                onRate={handleRating}
              />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
