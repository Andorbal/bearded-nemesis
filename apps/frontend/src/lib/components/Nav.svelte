<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import * as authApi from '$lib/api/auth';

  async function handleLogout() {
    const auth = $authStore;
    if (auth.refreshToken) {
      try {
        await authApi.logout(auth.refreshToken);
      } catch {
        // Ignore errors during logout
      }
    }
    authStore.logout();
    goto('/login');
  }

  function isActive(path: string): boolean {
    return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
  }
</script>

<nav class="bg-gray-800 text-white shadow-lg">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center">
        <a href="/" class="text-xl font-bold">Bearded Nemesis</a>

        {#if $authStore.user}
          <div class="ml-10 flex items-baseline space-x-4">
            <a
              href="/songs"
              class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
              class:bg-gray-900={isActive('/songs')}
            >
              Songs
            </a>
            <a
              href="/setlists"
              class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
              class:bg-gray-900={isActive('/setlists')}
            >
              Setlists
            </a>
            <a
              href="/playthroughs"
              class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
              class:bg-gray-900={isActive('/playthroughs')}
            >
              Playthroughs
            </a>
            {#if $authStore.user.isAdmin}
              <a
                href="/admin"
                class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                class:bg-gray-900={isActive('/admin')}
              >
                Admin
              </a>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex items-center">
        {#if $authStore.user}
          <span class="mr-4 text-sm">{$authStore.user.displayName}</span>
          <button
            onclick={handleLogout}
            class="btn btn-secondary text-sm"
          >
            Logout
          </button>
        {:else}
          <a href="/login" class="btn btn-primary text-sm">
            Login
          </a>
        {/if}
      </div>
    </div>
  </div>
</nav>
