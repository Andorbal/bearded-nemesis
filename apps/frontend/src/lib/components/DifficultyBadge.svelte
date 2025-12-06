<script lang="ts">
  interface Props {
    difficulty: number | null;
    instrument?: string;
  }

  let { difficulty, instrument = '' }: Props = $props();

  function getDifficultyClass(diff: number | null): string {
    if (diff === null) return 'badge-difficulty-1';
    if (diff <= 2) return 'badge-difficulty-1';
    if (diff <= 4) return 'badge-difficulty-3';
    if (diff <= 6) return 'badge-difficulty-5';
    return 'badge-difficulty-7';
  }
</script>

{#if difficulty !== null}
  <span class={`badge ${getDifficultyClass(difficulty)}`}>
    {instrument ? `${instrument}: ` : ''}{difficulty}
  </span>
{/if}
