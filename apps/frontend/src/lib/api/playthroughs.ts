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

export interface PlaythroughSummary {
  playthrough: Playthrough;
  setlist: { id: number; name: string } | null;
  players: Array<{
    userId: number;
    username: string;
    displayName: string;
    instrument: Instrument;
    difficulty: Difficulty;
    isProMode: boolean;
  }>;
  songs: Array<{
    position: number;
    song: Song;
    screenshotPath: string | null;
    ocrStatus: 'completed' | 'pending' | 'failed' | null;
    ratings: Array<{
      userId: number;
      username: string;
      rating: number;
    }>;
    stats: Array<{
      userId: number;
      username: string;
      score: number | null;
      accuracyPct: number | null;
      notesHit: number | null;
      notesMissed: number | null;
      longestStreak: number | null;
      starsEarned: number | null;
    }>;
  }>;
}

export async function getPlaythroughSummary(id: number): Promise<PlaythroughSummary> {
  return apiRequest<PlaythroughSummary>(`/playthroughs/${id}/summary`, {
    authenticated: true,
  });
}

export interface UpdateStatsRequest {
  score?: number;
  accuracyPct?: number;
  notesHit?: number;
  notesMissed?: number;
  longestStreak?: number;
  starsEarned?: number;
}

export async function updateStats(
  playthroughId: number,
  position: number,
  userId: number,
  updates: UpdateStatsRequest
): Promise<void> {
  await apiRequest(`/playthroughs/${playthroughId}/songs/${position}/stats/${userId}`, {
    method: 'PATCH',
    authenticated: true,
    body: JSON.stringify(updates),
  });
}

export async function retryOCR(playthroughId: number, position: number): Promise<void> {
  await apiRequest(`/playthroughs/${playthroughId}/songs/${position}/retry-ocr`, {
    method: 'POST',
    authenticated: true,
  });
}
