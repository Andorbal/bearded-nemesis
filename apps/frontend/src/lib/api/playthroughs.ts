import { apiRequest } from './client';
import type { Playthrough, Instrument, Difficulty, Song } from '@bearded-nemesis/shared';

export interface CreatePlaythroughRequest {
  setlistId: number;
  players: Array<{
    userId: number;
    instrument: Instrument;
    difficulty: Difficulty;
    proMode: boolean;
  }>;
}

export interface PlaythroughWithDetails extends Playthrough {
  setlist?: {
    id: number;
    name: string;
  };
  players?: Array<{
    userId: number;
    username: string;
    displayName: string;
    instrument: Instrument;
    difficulty: Difficulty;
    isProMode: boolean;
  }>;
  songs?: Array<{
    position: number;
    song: Song;
  }>;
}

export async function getPlaythroughs(): Promise<{ playthroughs: Playthrough[] }> {
  return apiRequest<{ playthroughs: Playthrough[] }>('/playthroughs', {
    authenticated: true,
  });
}

export async function getPlaythrough(id: number): Promise<PlaythroughWithDetails> {
  return apiRequest<PlaythroughWithDetails>(`/playthroughs/${id}`, {
    authenticated: true,
  });
}

export async function createPlaythrough(data: CreatePlaythroughRequest): Promise<Playthrough> {
  return apiRequest<Playthrough>('/playthroughs', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(data),
  });
}

export async function advanceSong(id: number): Promise<void> {
  await apiRequest(`/playthroughs/${id}/advance`, {
    method: 'PATCH',
    authenticated: true,
  });
}

export async function previousSong(id: number): Promise<void> {
  await apiRequest(`/playthroughs/${id}/back`, {
    method: 'PATCH',
    authenticated: true,
  });
}

export async function finishPlaythrough(id: number): Promise<void> {
  await apiRequest(`/playthroughs/${id}/finish`, {
    method: 'POST',
    authenticated: true,
  });
}

export async function submitRating(playthroughId: number, rating: number): Promise<void> {
  await apiRequest(`/playthroughs/${playthroughId}/rate`, {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify({ rating }),
  });
}

export async function uploadScreenshot(playthroughId: number, position: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('screenshot', file);

  await apiRequest(`/playthroughs/${playthroughId}/songs/${position}/screenshot`, {
    method: 'POST',
    authenticated: true,
    body: formData,
  });
}
