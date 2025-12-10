<script lang="ts">
  import { DIFFICULTIES, type Difficulty } from '@bearded-nemesis/shared';
  import NumberInput from './NumberInput.svelte';
  import StarRatingWithGold from './StarRatingWithGold.svelte';
  import * as playthroughsApi from '$lib/api/playthroughs';
  import { toastStore } from '$lib/stores/toast';

  interface Props {
    playthroughId: number;
    position: number;
    currentUserId: number;
    playerDifficulty: Difficulty; // Fallback from playthrough player
    previousSongDifficulty?: Difficulty | null; // Preferred default
    existingStats?: {
      score?: number | null;
      accuracyPct?: number | null;
      difficulty?: Difficulty | null;
      starsEarned?: number | null;
      longestStreak?: number | null;
      notesHit?: number | null;
      notesMissed?: number | null;
      avgMultiplier?: number | null;
    };
  }

  let {
    playthroughId,
    position,
    currentUserId,
    playerDifficulty,
    previousSongDifficulty,
    existingStats
  }: Props = $props();

  // Form state
  let completionPct = $state(existingStats?.accuracyPct ?? '');
  let difficulty = $state<Difficulty>(
    existingStats?.difficulty ??
    previousSongDifficulty ??
    playerDifficulty
  );
  let score = $state(existingStats?.score ?? '');
  let stars = $state(existingStats?.starsEarned ?? 0);
  let longestStreak = $state(existingStats?.longestStreak ?? '');
  let notesHit = $state(existingStats?.notesHit ?? '');
  let notesMissed = $state(existingStats?.notesMissed ?? '');
  let avgMultiplier = $state(existingStats?.avgMultiplier ?? '');

  async function saveField(field: string, value: any) {
    try {
      await playthroughsApi.updateStats(
        playthroughId,
        position,
        currentUserId,
        { [field]: value }
      );
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      toastStore.error(`Failed to save ${field}`);
      throw err;
    }
  }

  async function handleDifficultyChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newDifficulty = target.value as Difficulty;
    difficulty = newDifficulty;
    await saveField('difficulty', newDifficulty);
  }
</script>

<form class="card bg-white p-4">
  <h3 class="font-semibold mb-4 text-lg">My Stats</h3>

  <!-- Results Section -->
  <div class="mb-4">
    <h4 class="text-sm font-medium text-gray-600 mb-2">Results</h4>

    <NumberInput
      value={completionPct}
      label="Completion"
      suffix="%"
      min={0}
      max={100}
      step={0.1}
      inputmode="decimal"
      onSave={async (val) => {
        completionPct = val ?? '';
        await saveField('accuracyPct', val);
      }}
    />

    <div class="mb-3">
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Skill Level
      </label>
      <select
        bind:value={difficulty}
        onchange={handleDifficultyChange}
        class="input w-full"
      >
        {#each DIFFICULTIES as diff}
          <option value={diff}>{diff}</option>
        {/each}
      </select>
    </div>

    <NumberInput
      value={score}
      label="Score"
      inputmode="numeric"
      onSave={async (val) => {
        score = val ?? '';
        await saveField('score', val);
      }}
    />

    <div class="mb-3">
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Stars
      </label>
      <StarRatingWithGold
        {stars}
        interactive={true}
        onSelect={async (newStars) => {
          stars = newStars;
          await saveField('starsEarned', newStars);
        }}
      />
    </div>
  </div>

  <!-- Performance Section -->
  <div>
    <h4 class="text-sm font-medium text-gray-600 mb-2">Performance</h4>

    <NumberInput
      value={longestStreak}
      label="Longest Streak"
      inputmode="numeric"
      onSave={async (val) => {
        longestStreak = val ?? '';
        await saveField('longestStreak', val);
      }}
    />

    <NumberInput
      value={notesHit}
      label="Notes Hit"
      inputmode="numeric"
      onSave={async (val) => {
        notesHit = val ?? '';
        await saveField('notesHit', val);
      }}
    />

    <NumberInput
      value={notesMissed}
      label="Notes Missed"
      inputmode="numeric"
      onSave={async (val) => {
        notesMissed = val ?? '';
        await saveField('notesMissed', val);
      }}
    />

    <NumberInput
      value={avgMultiplier}
      label="Avg. Multiplier"
      step={0.1}
      inputmode="decimal"
      onSave={async (val) => {
        avgMultiplier = val ?? '';
        await saveField('avgMultiplier', val);
      }}
    />
  </div>
</form>
