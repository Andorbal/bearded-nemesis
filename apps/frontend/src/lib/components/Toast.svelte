<script lang="ts">
  import { toastStore } from '$lib/stores/toast';

  function getToastClasses(type: string) {
    const baseClasses = 'p-4 rounded-lg shadow-lg text-white mb-2 min-w-[300px] max-w-md';
    const typeClasses: Record<string, string> = {
      success: 'bg-green-600',
      error: 'bg-red-600',
      info: 'bg-blue-600',
      warning: 'bg-yellow-600',
    };
    return `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
  }
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col items-end">
  {#each $toastStore as toast (toast.id)}
    <div class={getToastClasses(toast.type)} role="alert">
      <div class="flex items-center justify-between">
        <span>{toast.message}</span>
        <button
          class="ml-4 text-white hover:text-gray-200"
          onclick={() => toastStore.dismiss(toast.id)}
          aria-label="Dismiss"
        >
          x
        </button>
      </div>
    </div>
  {/each}
</div>
