<script lang="ts">
  import { toastStore } from '$lib/stores/toast';

  interface Stats {
    userId: number;
    username: string;
    score: number | null;
    accuracyPct: number | null;
    notesHit: number | null;
    notesMissed: number | null;
    longestStreak: number | null;
    starsEarned: number | null;
  }

  interface Props {
    stats: Stats;
    onSave: (updates: Partial<Stats>) => Promise<void>;
    onCancel: () => void;
  }

  let { stats, onSave, onCancel }: Props = $props();

  let score = $state(stats.score ?? '');
  let accuracyPct = $state(stats.accuracyPct ?? '');
  let notesHit = $state(stats.notesHit ?? '');
  let notesMissed = $state(stats.notesMissed ?? '');
  let longestStreak = $state(stats.longestStreak ?? '');
  let starsEarned = $state(stats.starsEarned ?? '');
  let saving = $state(false);

  async function handleSave() {
    saving = true;
    try {
      const updates: any = {};

      if (score !== '') updates.score = Number(score);
      if (accuracyPct !== '') {
        const pct = Number(accuracyPct);
        if (pct < 0 || pct > 100) {
          toastStore.error('Accuracy must be between 0 and 100');
          saving = false;
          return;
        }
        updates.accuracyPct = pct;
      }
      if (notesHit !== '') updates.notesHit = Number(notesHit);
      if (notesMissed !== '') updates.notesMissed = Number(notesMissed);
      if (longestStreak !== '') updates.longestStreak = Number(longestStreak);
      if (starsEarned !== '') {
        const stars = Number(starsEarned);
        if (stars < 1 || stars > 6) {
          toastStore.error('Stars must be between 1 and 6');
          saving = false;
          return;
        }
        updates.starsEarned = stars;
      }

      await onSave(updates);
      toastStore.success('Stats updated');
    } catch (err) {
      console.error('Failed to save stats:', err);
      toastStore.error('Failed to save stats');
    } finally {
      saving = false;
    }
  }
</script>

<div class="bg-gray-50 p-4 rounded-lg">
  <div class="font-medium mb-3">{stats.username}</div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="block text-xs text-gray-600 mb-1">Score</label>
      <input type="number" bind:value={score} class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Accuracy %</label>
      <input type="number" bind:value={accuracyPct} min="0" max="100" step="0.1" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Notes Hit</label>
      <input type="number" bind:value={notesHit} min="0" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Notes Missed</label>
      <input type="number" bind:value={notesMissed} min="0" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Longest Streak</label>
      <input type="number" bind:value={longestStreak} min="0" class="input input-sm w-full" />
    </div>

    <div>
      <label class="block text-xs text-gray-600 mb-1">Stars (1-6)</label>
      <input type="number" bind:value={starsEarned} min="1" max="6" class="input input-sm w-full" />
    </div>
  </div>

  <div class="flex gap-2 mt-4">
    <button onclick={handleSave} class="btn btn-primary btn-sm" disabled={saving}>
      {saving ? 'Saving...' : 'Save Changes'}
    </button>
    <button onclick={onCancel} class="btn btn-secondary btn-sm" disabled={saving}>
      Cancel
    </button>
  </div>
</div>
