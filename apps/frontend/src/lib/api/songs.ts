import { apiRequest } from './client';
import type { Song, UserSong, Instrument } from '@bearded-nemesis/shared';

export interface SearchSongsParams {
  q?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  instrument?: string;
  genre?: string;
  limit?: number;
  offset?: number;
}

export interface SearchSongsResponse {
  songs: Song[];
  total: number;
  limit: number;
  offset: number;
}

export async function searchSongs(params: SearchSongsParams): Promise<SearchSongsResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.minDifficulty !== undefined) query.set('minDifficulty', params.minDifficulty.toString());
  if (params.maxDifficulty !== undefined) query.set('maxDifficulty', params.maxDifficulty.toString());
  if (params.instrument) query.set('instrument', params.instrument);
  if (params.genre) query.set('genre', params.genre);
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.offset) query.set('offset', params.offset.toString());

  return apiRequest<SearchSongsResponse>(`/songs?${query.toString()}`);
}

export async function getSong(id: number): Promise<Song> {
  return apiRequest<Song>(`/songs/${id}`);
}

export async function getUserSong(id: number): Promise<UserSong> {
  return apiRequest<UserSong>(`/songs/${id}/user`, {
    authenticated: true,
  });
}

export async function setOwned(id: number, owned: boolean): Promise<UserSong> {
  return apiRequest<UserSong>(`/songs/${id}/owned`, {
    method: 'PUT',
    authenticated: true,
    body: JSON.stringify({ owned }),
  });
}

export async function setSongRating(id: number, rating: number): Promise<UserSong> {
  return apiRequest<UserSong>(`/songs/${id}/rating`, {
    method: 'PUT',
    authenticated: true,
    body: JSON.stringify({ rating }),
  });
}

export async function submitPlayRating(
  id: number,
  instrument: Instrument,
  rating: number
): Promise<void> {
  await apiRequest(`/songs/${id}/play-rating`, {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify({ instrument, rating }),
  });
}
