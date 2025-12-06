<script lang="ts">
  import { goto } from '$app/navigation';
  import * as setlistsApi from '$lib/api/setlists';
  import { toastStore } from '$lib/stores/toast';

  let name = $state('');
  let loading = $state(false);

  async function handleCreate() {
    if (!name.trim()) {
      toastStore.error('Please enter a setlist name');
      return;
    }

    loading = true;
    try {
      const setlist = await setlistsApi.createSetlist({
        name: name.trim(),
        type: 'manual',
      });
      toastStore.success('Setlist created!');
      goto(`/setlists/${setlist.id}`);
    } catch (err) {
      console.error('Failed to create setlist:', err);
      toastStore.error('Failed to create setlist');
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <button onclick={() => goto('/setlists')} class="btn btn-secondary mb-4">
    &larr; Back to Setlists
  </button>

  <div class="card max-w-md">
    <h1 class="text-2xl font-bold mb-6">Create Manual Setlist</h1>

    <div class="mb-4">
      <label for="name" class="block text-sm font-medium mb-2">Setlist Name</label>
      <input
        id="name"
        type="text"
        bind:value={name}
        class="input"
        placeholder="My Awesome Setlist"
        disabled={loading}
      />
    </div>

    <button
      onclick={handleCreate}
      class="btn btn-primary w-full"
      disabled={loading}
    >
      {loading ? 'Creating...' : 'Create Setlist'}
    </button>
  </div>
</div>
