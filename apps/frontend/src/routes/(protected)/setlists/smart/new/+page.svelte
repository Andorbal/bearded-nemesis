<script lang="ts">
  import { goto } from '$app/navigation';
  import * as setlistsApi from '$lib/api/setlists';
  import type { SmartFilter, Instrument } from '@bearded-nemesis/shared';
  import { INSTRUMENTS } from '@bearded-nemesis/shared';
  import { toastStore } from '$lib/stores/toast';

  let name = $state('');
  let minRating = $state<number | undefined>(undefined);
  let maxRating = $state<number | undefined>(undefined);
  let minDifficulty = $state<number | undefined>(undefined);
  let maxDifficulty = $state<number | undefined>(undefined);
  let selectedInstruments = $state<Instrument[]>([]);
  let ownedOnly = $state(false);
  let sortBy = $state<SmartFilter['sortBy']>('artist');
  let sortOrder = $state<SmartFilter['sortOrder']>('asc');
  let loading = $state(false);

  function toggleInstrument(instrument: Instrument) {
    if (selectedInstruments.includes(instrument)) {
      selectedInstruments = selectedInstruments.filter(i => i !== instrument);
    } else {
      selectedInstruments = [...selectedInstruments, instrument];
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toastStore.error('Please enter a setlist name');
      return;
    }

    const smartFilter: SmartFilter = {
      minRating,
      maxRating,
      minDifficulty,
      maxDifficulty,
      instruments: selectedInstruments.length > 0 ? selectedInstruments : undefined,
      ownedOnly: ownedOnly || undefined,
      sortBy,
      sortOrder,
    };

    loading = true;
    try {
      const setlist = await setlistsApi.createSetlist({
        name: name.trim(),
        type: 'smart',
        smartFilter,
      });

      // Generate songs immediately
      await setlistsApi.generateSmartSetlist(setlist.id, true);

      toastStore.success('Smart setlist created!');
      goto(`/setlists/${setlist.id}`);
    } catch (err) {
      console.error('Failed to create smart setlist:', err);
      toastStore.error('Failed to create smart setlist');
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <button onclick={() => goto('/setlists')} class="btn btn-secondary mb-4">
    &larr; Back to Setlists
  </button>

  <div class="card max-w-2xl">
    <h1 class="text-2xl font-bold mb-6">Create Smart Setlist</h1>

    <div class="space-y-4">
      <div>
        <label for="name" class="block text-sm font-medium mb-2">Setlist Name</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          class="input"
          placeholder="Hard Drums"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="minRating" class="block text-sm font-medium mb-2">Min Rating</label>
          <input
            id="minRating"
            type="number"
            bind:value={minRating}
            class="input"
            min="1"
            max="5"
            placeholder="1-5"
          />
        </div>
        <div>
          <label for="maxRating" class="block text-sm font-medium mb-2">Max Rating</label>
          <input
            id="maxRating"
            type="number"
            bind:value={maxRating}
            class="input"
            min="1"
            max="5"
            placeholder="1-5"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="minDifficulty" class="block text-sm font-medium mb-2">Min Difficulty</label>
          <input
            id="minDifficulty"
            type="number"
            bind:value={minDifficulty}
            class="input"
            min="0"
            max="7"
            placeholder="0-7"
          />
        </div>
        <div>
          <label for="maxDifficulty" class="block text-sm font-medium mb-2">Max Difficulty</label>
          <input
            id="maxDifficulty"
            type="number"
            bind:value={maxDifficulty}
            class="input"
            min="0"
            max="7"
            placeholder="0-7"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Instruments</label>
        <div class="flex gap-2">
          {#each INSTRUMENTS as instrument}
            <button
              onclick={() => toggleInstrument(instrument)}
              class={`btn ${selectedInstruments.includes(instrument) ? 'btn-primary' : 'btn-secondary'}`}
            >
              {instrument}
            </button>
          {/each}
        </div>
      </div>

      <div>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            bind:checked={ownedOnly}
            class="w-4 h-4"
          />
          <span class="text-sm font-medium">Owned songs only</span>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="sortBy" class="block text-sm font-medium mb-2">Sort By</label>
          <select id="sortBy" bind:value={sortBy} class="input">
            <option value="rating">Rating</option>
            <option value="difficulty">Difficulty</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="random">Random</option>
          </select>
        </div>
        <div>
          <label for="sortOrder" class="block text-sm font-medium mb-2">Order</label>
          <select id="sortOrder" bind:value={sortOrder} class="input">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <button
        onclick={handleCreate}
        class="btn btn-primary w-full"
        disabled={loading}
      >
        {loading ? 'Creating...' : 'Create Smart Setlist'}
      </button>
    </div>
  </div>
</div>
