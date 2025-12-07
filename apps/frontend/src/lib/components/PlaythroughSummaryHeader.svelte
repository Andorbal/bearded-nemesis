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
