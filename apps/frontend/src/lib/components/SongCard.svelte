<script lang="ts">
  import type { Song } from '@bearded-nemesis/shared';
  import DifficultyBadge from './DifficultyBadge.svelte';

  interface Props {
    song: Song;
    onclick?: () => void;
  }

  let { song, onclick }: Props = $props();
</script>

<div
  class="card hover:shadow-xl transition-shadow cursor-pointer"
  role="button"
  tabindex="0"
  onclick={onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
  {#if song.coverArtUrl}
    <img
      src={song.coverArtUrl}
      alt={`${song.title} cover`}
      class="w-full h-32 object-cover rounded-t-lg mb-2"
    />
  {/if}

  <h3 class="font-bold text-lg truncate">{song.title}</h3>
  <p class="text-gray-600 text-sm truncate">{song.artist}</p>

  {#if song.album}
    <p class="text-gray-500 text-xs truncate mt-1">{song.album}</p>
  {/if}

  <div class="mt-2 flex flex-wrap gap-1">
    <DifficultyBadge difficulty={song.difficultyDrums} instrument="D" />
    <DifficultyBadge difficulty={song.difficultyGuitar} instrument="G" />
    <DifficultyBadge difficulty={song.difficultyBass} instrument="B" />
    <DifficultyBadge difficulty={song.difficultyVocals} instrument="V" />
  </div>
</div>
