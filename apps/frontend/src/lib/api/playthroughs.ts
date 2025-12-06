import { apiRequest } from './client';
import type { Playthrough, Instrument, Difficulty, Song } from '@bearded-nemesis/shared';

export interface CreatePlaythroughRequest {
  setlistId: number;
  players: Array<{
    userId: number;
    instrument: Instrument;
    difficulty: Difficulty;
    isProMode: boolean;
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
    method: 'POST',
    authenticated: true,
  });
}

export async function previousSong(id: number): Promise<void> {
  await apiRequest(`/playthroughs/${id}/back`, {
    method: 'POST',
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
  formData.append('position', position.toString());

  const response = await fetch(`/api/playthroughs/${playthroughId}/screenshot`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('bearded-nemesis-auth') ? JSON.parse(localStorage.getItem('bearded-nemesis-auth')!).accessToken : ''}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload screenshot');
  }
}
