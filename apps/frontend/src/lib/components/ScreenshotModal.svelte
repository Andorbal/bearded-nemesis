<script lang="ts">
  import { toastStore } from '$lib/stores/toast';
  import * as playthroughsApi from '$lib/api/playthroughs';

  interface Props {
    screenshotPath: string;
    playthroughId: number;
    position: number;
    onClose: () => void;
    onRerunOCR?: () => void;
  }

  let { screenshotPath, playthroughId, position, onClose, onRerunOCR }: Props = $props();

  let rerunning = $state(false);

  async function handleRerunOCR() {
    rerunning = true;
    try {
      await playthroughsApi.retryOCR(playthroughId, position);
      toastStore.success('OCR retry started');
      onRerunOCR?.();
      onClose();
    } catch (err) {
      console.error('Failed to retry OCR:', err);
      toastStore.error('Failed to retry OCR');
    } finally {
      rerunning = false;
    }
  }
</script>

<!-- Modal overlay -->
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={onClose}>
  <!-- Modal content -->
  <div class="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto" onclick={(e) => e.stopPropagation()}>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Screenshot</h2>
      <button onclick={onClose} class="text-gray-500 hover:text-gray-700">✕</button>
    </div>

    <img src={screenshotPath} alt="Playthrough screenshot" class="max-w-full mb-4" />

    <div class="flex gap-2">
      {#if onRerunOCR}
        <button onclick={handleRerunOCR} class="btn btn-secondary" disabled={rerunning}>
          {rerunning ? 'Processing...' : 'Re-run OCR'}
        </button>
      {/if}
      <button onclick={onClose} class="btn btn-primary">Close</button>
    </div>
  </div>
</div>
