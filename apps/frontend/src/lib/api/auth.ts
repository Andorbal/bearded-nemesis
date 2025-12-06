import { apiRequest } from './client';
import type { User } from '@bearded-nemesis/shared';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    isAdmin: boolean;
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me', {
    authenticated: true,
  });
}
