import { authStore } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';

export function requireAuth() {
  const auth = get(authStore);
  if (!auth.user) {
    goto('/login');
    return false;
  }
  return true;
}

export function requireAdmin() {
  const auth = get(authStore);
  if (!auth.user || !auth.user.isAdmin) {
    goto('/');
    return false;
  }
  return true;
}
