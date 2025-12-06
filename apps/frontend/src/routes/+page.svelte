<script lang="ts">
  import { authStore } from '$lib/stores/auth';
</script>

<div class="text-center py-12">
  <h1 class="text-4xl font-bold mb-4">Welcome to Bearded Nemesis</h1>
  <p class="text-xl text-gray-600 mb-8">Rock Band 4 Setlist Manager</p>

  {#if $authStore.user}
    <div class="space-y-4">
      <p class="text-gray-700">Welcome back, {$authStore.user.displayName}!</p>
      <div class="flex justify-center gap-4">
        <a href="/songs" class="btn btn-primary">Browse Songs</a>
        <a href="/setlists" class="btn btn-primary">My Setlists</a>
        <a href="/playthroughs" class="btn btn-secondary">Playthroughs</a>
      </div>
    </div>
  {:else}
    <div class="space-y-4">
      <p class="text-gray-700">Manage your song library, create setlists, and track your performances.</p>
      <a href="/login" class="btn btn-primary">Login to Get Started</a>
    </div>
  {/if}
</div>
