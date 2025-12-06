import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';
import { get } from 'svelte/store';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public override message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean;
  skipRefresh?: boolean;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { authenticated = false, skipRefresh = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (authenticated) {
    const auth = get(authStore);
    if (auth.accessToken) {
      headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }
  }

  const url = `${API_BASE}${endpoint}`;

  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // If 401 and we have a refresh token, try to refresh
  if (response.status === 401 && authenticated && !skipRefresh) {
    const auth = get(authStore);
    if (auth.refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          authStore.setTokens(tokens.accessToken, tokens.refreshToken);

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${tokens.accessToken}`;
          response = await fetch(url, {
            ...fetchOptions,
            headers,
          });
        } else {
          // Refresh failed, logout
          authStore.logout();
          goto('/login');
          throw new ApiError(401, 'Session expired. Please login again.');
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        authStore.logout();
        goto('/login');
        throw new ApiError(401, 'Session expired. Please login again.');
      }
    } else {
      authStore.logout();
      goto('/login');
      throw new ApiError(401, 'Not authenticated.');
    }
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData: unknown = undefined;

    try {
      errorData = await response.json();
      if (errorData && typeof errorData === 'object' && 'error' in errorData) {
        errorMessage = (errorData as { error: string }).error;
      }
    } catch {
      // Couldn't parse error JSON
    }

    throw new ApiError(response.status, errorMessage, errorData);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
