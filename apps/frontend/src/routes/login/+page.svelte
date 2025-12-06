<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';
  import * as authApi from '$lib/api/auth';
  import { onMount } from 'svelte';

  let username = $state('');
  let password = $state('');
  let loading = $state(false);

  onMount(() => {
    // If already logged in, redirect
    if ($authStore.user) {
      goto('/');
    }
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!username || !password) {
      toastStore.error('Please enter username and password');
      return;
    }

    loading = true;
    try {
      const result = await authApi.login(username, password);
      authStore.login(result.accessToken, result.refreshToken, result.user);
      toastStore.success(`Welcome back, ${result.user.displayName}!`);
      goto('/');
    } catch (err) {
      console.error('Login failed:', err);
      toastStore.error('Invalid username or password');
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-md mx-auto mt-16">
  <div class="card">
    <h1 class="text-2xl font-bold mb-6 text-center">Login to Bearded Nemesis</h1>

    <form onsubmit={handleSubmit}>
      <div class="mb-4">
        <label for="username" class="block text-sm font-medium mb-2">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          class="input"
          placeholder="Enter your username"
          disabled={loading}
        />
      </div>

      <div class="mb-6">
        <label for="password" class="block text-sm font-medium mb-2">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          class="input"
          placeholder="Enter your password"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        class="btn btn-primary w-full"
        disabled={loading}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>

    <div class="mt-4 text-sm text-gray-600 text-center">
      <p>Demo accounts:</p>
      <p>admin / admin123 | testuser / test123</p>
    </div>
  </div>
</div>
