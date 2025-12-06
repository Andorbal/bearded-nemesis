import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: number;
    username: string;
    displayName: string;
    isAdmin: boolean;
  } | null;
}

const STORAGE_KEY = 'bearded-nemesis-auth';

function loadAuthState(): AuthState {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error('Failed to load auth state:', err);
    }
  }
  return { accessToken: null, refreshToken: null, user: null };
}

function saveAuthState(state: AuthState): void {
  if (browser) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save auth state:', err);
    }
  }
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(loadAuthState());

  return {
    subscribe,
    login(accessToken: string, refreshToken: string, user: AuthState['user']) {
      const newState: AuthState = { accessToken, refreshToken, user };
      set(newState);
      saveAuthState(newState);
    },
    setTokens(accessToken: string, refreshToken: string) {
      update(state => {
        const newState = { ...state, accessToken, refreshToken };
        saveAuthState(newState);
        return newState;
      });
    },
    logout() {
      const emptyState: AuthState = { accessToken: null, refreshToken: null, user: null };
      set(emptyState);
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
  };
}

export const authStore = createAuthStore();
