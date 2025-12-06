import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';
import { get } from 'svelte/store';

export function load() {
  if (browser) {
    const auth = get(authStore);
    if (!auth.user) {
      goto('/login');
      return;
    }
  }
  return {};
}
