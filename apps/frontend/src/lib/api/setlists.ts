import { apiRequest } from './client';
import type { Setlist, SetlistType, SmartFilter, Song, BuilderPreset } from '@bearded-nemesis/shared';

export interface CreateSetlistRequest {
  name: string;
  type: SetlistType;
  smartFilter?: SmartFilter;
  builderPreset?: BuilderPreset;
}

export interface SetlistSongItem {
  setlistId: number;
  songId: number;
  position: number;
  song: Song;
}

export interface SetlistWithSongs extends Setlist {
  songs: SetlistSongItem[];
}

export async function getSetlists(): Promise<{ setlists: Setlist[] }> {
  return apiRequest<{ setlists: Setlist[] }>('/setlists', {
    authenticated: true,
  });
}

export async function getSetlist(id: number): Promise<Setlist> {
  return apiRequest<Setlist>(`/setlists/${id}`, {
    authenticated: true,
  });
}

export async function getSetlistSongs(id: number): Promise<SetlistSongItem[]> {
  const result = await apiRequest<{ songs: SetlistSongItem[] }>(`/setlists/${id}/songs`, {
    authenticated: true,
  });
  return result.songs;
}

export async function createSetlist(data: CreateSetlistRequest): Promise<Setlist> {
  return apiRequest<Setlist>('/setlists', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(data),
  });
}

export async function updateSetlist(id: number, data: Partial<CreateSetlistRequest>): Promise<Setlist> {
  return apiRequest<Setlist>(`/setlists/${id}`, {
    method: 'PATCH',
    authenticated: true,
    body: JSON.stringify(data),
  });
}

export async function deleteSetlist(id: number): Promise<void> {
  await apiRequest(`/setlists/${id}`, {
    method: 'DELETE',
    authenticated: true,
  });
}

export async function addSongsToSetlist(id: number, songIds: number[]): Promise<SetlistSongItem[]> {
  const result = await apiRequest<{ songs: SetlistSongItem[] }>(`/setlists/${id}/songs`, {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify({ songIds }),
  });
  return result.songs;
}

export async function removeSongFromSetlist(id: number, songId: number): Promise<SetlistSongItem[]> {
  const result = await apiRequest<{ songs: SetlistSongItem[] }>(`/setlists/${id}/songs/${songId}`, {
    method: 'DELETE',
    authenticated: true,
  });
  return result.songs;
}

export async function reorderSetlistSongs(id: number, songIds: number[]): Promise<SetlistSongItem[]> {
  const result = await apiRequest<{ songs: SetlistSongItem[] }>(`/setlists/${id}/songs/order`, {
    method: 'PUT',
    authenticated: true,
    body: JSON.stringify({ songIds }),
  });
  return result.songs;
}

export async function generateSmartSetlist(id: number, apply: boolean = false): Promise<{ songs: Song[]; applied: boolean }> {
  return apiRequest<{ songs: Song[]; applied: boolean }>(`/setlists/${id}/generate?apply=${apply}`, {
    method: 'POST',
    authenticated: true,
  });
}

export interface LpSolveRequest {
  players: Array<{
    userId: number;
    instrument: string;
    difficulty: string;
    proMode: boolean;
  }>;
  objective: 'play_rating' | 'song_rating' | 'discovery' | 'combined';
  ratingAggregation: 'average' | 'minimum' | 'maximum';
  constraints: {
    songCountMin?: number;
    songCountMax?: number;
    maxDurationMinutes?: number;
    minAvgPlayRating?: number;
    minAvgSongRating?: number;
    difficultyMin?: number;
    difficultyMax?: number;
    unplayedMinimum?: number;
    avoidPlayedWithinDays?: number;
    bpmMin?: number;
    bpmMax?: number;
    requiredSongIds?: number[];
    excludedSongIds?: number[];
  };
}

export interface LpSolveResponse {
  songs: Song[];
  totalDurationMinutes: number;
  stats: {
    avgPlayRating: number;
    avgSongRating: number;
    avgDifficulty: number;
    unplayedCount: number;
  };
}

export async function lpSolve(request: LpSolveRequest): Promise<LpSolveResponse> {
  return apiRequest<LpSolveResponse>('/setlists/lp-solve', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(request),
  });
}
