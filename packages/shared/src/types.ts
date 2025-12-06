import type { Instrument, Difficulty, SetlistType, PlaythroughStatus, RatingAggregation } from './constants.js';

// ============ Users ============
export interface User {
  id: number;
  username: string;
  displayName: string;
  xboxGamertag: string | null;
  isAdmin: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface UserCreate {
  username: string;
  password: string;
  displayName: string;
  xboxGamertag?: string;
  isAdmin?: boolean;
}

// ============ Songs ============
export interface Song {
  id: number;
  slug: string;
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  durationMs: number | null;
  bpm: number | null;
  genre: string | null;
  coverArtUrl: string | null;
  youtubeUrl: string | null;
  spotifyId: string | null;
  difficultyDrums: number | null;
  difficultyGuitar: number | null;
  difficultyBass: number | null;
  difficultyVocals: number | null;
  difficultyKeys: number | null;
  rankingGuitar: number | null;
  rankingBass: number | null;
  rankingDrums: number | null;
  rankingVocals: number | null;
  rankingBand: number | null;
  releaseDate: string | null;
  harmoniesCount: number | null;
  sourceArray: string[] | null;
}

export interface UserSong {
  userId: number;
  songId: number;
  owned: boolean;
  songRating: number | null; // 1-5, how much they like the song itself
}

export interface SongRating {
  id: number;
  userId: number;
  songId: number;
  instrument: Instrument;
  rating: number; // 1-5
  playthroughSongId: number | null;
  createdAt: Date;
}

// ============ Setlists ============
export interface Setlist {
  id: number;
  userId: number;
  name: string;
  type: SetlistType;
  smartFilter: SmartFilter | null;
  builderPreset: BuilderPreset | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetlistSong {
  setlistId: number;
  songId: number;
  position: number;
}

export interface SmartFilter {
  minRating?: number;
  maxRating?: number;
  minDifficulty?: number;
  maxDifficulty?: number;
  instruments?: Instrument[];
  ownedOnly?: boolean;
  sortBy?: 'rating' | 'difficulty' | 'title' | 'artist' | 'random';
  sortOrder?: 'asc' | 'desc';
}

export interface BuilderPreset {
  name: string;
  players: BuilderPlayer[];
  objective: 'play_rating' | 'song_rating' | 'discovery' | 'combined';
  ratingAggregation: RatingAggregation;
  constraints: BuilderConstraints;
}

export interface BuilderPlayer {
  userId: number;
  instrument: Instrument;
  difficulty: Difficulty;
  proMode: boolean;
}

export interface BuilderConstraints {
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
}

// ============ Playthroughs ============
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Playthrough {
  id: number;
  setlistId: number;
  createdBy: number;
  status: PlaythroughStatus;
  currentPosition: number;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface PlaythroughPlayer {
  playthroughId: number;
  userId: number;
  instrument: Instrument;
  difficulty: Difficulty;
  isProMode: boolean;
}

export interface PlaythroughSong {
  id: number;
  playthroughId: number;
  songId: number;
  position: number;
  screenshotPath: string | null;
  ocrStatus: OcrStatus | null;
  ocrError: string | null;
  ocrProcessedAt: Date | null;
}

export interface PlaythroughSongStats {
  id: number;
  playthroughSongId: number;
  userId: number;
  score: number | null;
  notesHit: number | null;
  notesMissed: number | null;
  longestStreak: number | null;
  starsEarned: number | null; // game's 1-5
  accuracyPct: number | null;
  rating: number | null; // user's enjoyment 1-5
  createdAt: Date;
}

// ============ Auth ============
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
}

// ============ WebSocket Messages ============
export type WsServerMessage =
  | { type: 'state_sync'; state: PlaythroughState }
  | { type: 'song_advanced'; position: number; song: Song }
  | { type: 'song_back'; position: number; song: Song }
  | { type: 'player_joined'; user: string }
  | { type: 'player_left'; user: string }
  | { type: 'rating_submitted'; user: string; rating: number }
  | { type: 'stats_captured'; position: number }
  | { type: 'screenshot_uploaded'; position: number; song: Song }
  | { type: 'ocr_completed'; position: number; playersMatched: number }
  | { type: 'playthrough_finished'; summary: PlaythroughSummary };

export type WsClientMessage =
  | { type: 'submit_rating'; rating: number };

export interface PlaythroughState {
  playthroughId: number;
  currentPosition: number;
  currentSong: Song;
  songs: Song[];
  players: string[];
  ratingsThisSong: Record<string, number>;
}

export interface PlaythroughSummary {
  totalSongs: number;
  completedSongs: number;
  playerStats: Record<string, { avgRating: number; songsRated: number }>;
}
