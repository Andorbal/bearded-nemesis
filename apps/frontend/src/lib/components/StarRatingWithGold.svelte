<script lang="ts">
  interface Props {
    stars: number; // 0-6, where 6 = gold 5-star
    interactive?: boolean;
    onSelect?: (stars: number) => void;
  }

  let { stars = 0, interactive = false, onSelect }: Props = $props();

  let currentStars = $state(stars === 6 ? 5 : stars);
  let isGold = $state(stars === 6);

  // Sync with external changes
  $effect(() => {
    currentStars = stars === 6 ? 5 : stars;
    isGold = stars === 6;
  });

  function handleStarClick(index: number) {
    if (!interactive || !onSelect) return;

    const newStars = index + 1;
    currentStars = newStars;

    // Auto-disable gold if selecting less than 5 stars
    if (newStars < 5) {
      isGold = false;
      onSelect(newStars);
    } else {
      onSelect(isGold ? 6 : 5);
    }
  }

  function handleGoldToggle() {
    if (!interactive || !onSelect || currentStars < 5) return;

    isGold = !isGold;
    onSelect(isGold ? 6 : 5);
  }

  const starColor = $derived(isGold ? 'text-yellow-400' : 'text-gray-300');
  const filledStarColor = $derived(isGold ? 'text-yellow-400' : 'text-yellow-500');
</script>

<div class="flex items-center gap-3">
  <!-- 5 Stars -->
  <div class="flex items-center gap-1">
    {#each Array(5) as _, index}
      <button
        type="button"
        disabled={!interactive}
        onclick={async () => await handleStarClick(index)}
        class="text-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        class:cursor-pointer={interactive}
        class:cursor-default={!interactive}
      >
        {#if index < currentStars}
          <span class={filledStarColor}>★</span>
        {:else}
          <span class={starColor}>☆</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Gold Toggle (only show if 5 stars selected) -->
  {#if currentStars === 5}
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        bind:checked={isGold}
        onchange={async () => await handleGoldToggle()}
        disabled={!interactive}
        class="form-checkbox h-4 w-4 text-yellow-500 rounded"
      />
      <span class="text-sm font-medium text-gray-700">Gold</span>
    </label>
  {/if}
</div>
