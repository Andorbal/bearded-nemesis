<script lang="ts">
  import type { Setlist } from '@bearded-nemesis/shared';

  interface Props {
    setlist: Setlist;
    onclick?: () => void;
    onDelete?: () => void;
  }

  let { setlist, onclick, onDelete }: Props = $props();

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      manual: 'Manual',
      smart: 'Smart Filter',
      builder: 'LP Builder',
    };
    return labels[type] || type;
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }
</script>

<div class="card hover:shadow-xl transition-shadow">
  <div
    class="cursor-pointer"
    role="button"
    tabindex="0"
    onclick={onclick}
    onkeydown={(e) => e.key === 'Enter' && onclick?.()}
  >
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-bold text-lg">{setlist.name}</h3>
      <span class="badge bg-blue-100 text-blue-800">{getTypeLabel(setlist.type)}</span>
    </div>
    <p class="text-gray-600 text-sm">Updated: {formatDate(setlist.updatedAt)}</p>
  </div>

  {#if onDelete}
    <button
      onclick={(e) => {
        e.stopPropagation();
        onDelete?.();
      }}
      class="btn btn-danger text-sm mt-3"
    >
      Delete
    </button>
  {/if}
</div>
