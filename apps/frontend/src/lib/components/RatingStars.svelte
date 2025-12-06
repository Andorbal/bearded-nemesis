<script lang="ts">
  interface Props {
    rating: number | null;
    max?: number;
    interactive?: boolean;
    onRate?: (rating: number) => void;
  }

  let { rating, max = 5, interactive = false, onRate }: Props = $props();

  let hoverRating = $state<number | null>(null);

  function handleClick(value: number) {
    if (interactive && onRate) {
      onRate(value);
    }
  }

  function handleMouseEnter(value: number) {
    if (interactive) {
      hoverRating = value;
    }
  }

  function handleMouseLeave() {
    hoverRating = null;
  }

  const displayRating = $derived(hoverRating ?? rating ?? 0);
</script>

<div class="flex items-center">
  {#each Array(max) as _, i}
    {@const value = i + 1}
    <button
      type="button"
      class={`text-2xl ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
      onclick={() => handleClick(value)}
      onmouseenter={() => handleMouseEnter(value)}
      onmouseleave={handleMouseLeave}
      disabled={!interactive}
    >
      {#if value <= displayRating}
        <span class="text-yellow-500">*</span>
      {:else}
        <span class="text-gray-300">*</span>
      {/if}
    </button>
  {/each}
</div>
