import { query, queryOne } from '../db/pool.js';
import type { PlaythroughSongStats, Difficulty } from '@bearded-nemesis/shared';

interface CreateStatsData {
  playthroughSongId: number;
  userId: number;
  score?: number | null;
  notesHit?: number | null;
  notesMissed?: number | null;
  longestStreak?: number | null;
  starsEarned?: number | null;
  accuracyPct?: number | null;
  difficulty?: string | null;
  avgMultiplier?: number | null;
  rating?: number | null;
}

interface UpdateStatsData {
  score?: number | null;
  notesHit?: number | null;
  notesMissed?: number | null;
  longestStreak?: number | null;
  starsEarned?: number | null;
  accuracyPct?: number | null;
  difficulty?: string | null;
  avgMultiplier?: number | null;
  rating?: number | null;
}

interface DbPlaythroughSongStats {
  id: number;
  playthrough_song_id: number;
  user_id: number;
  score: number | null;
  notes_hit: number | null;
  notes_missed: number | null;
  longest_streak: number | null;
  stars_earned: number | null;
  accuracy_pct: string | null;
  difficulty: string | null;
  avg_multiplier: string | null;
  rating: number | null;
  created_at: Date;
}

function mapToStats(row: DbPlaythroughSongStats): PlaythroughSongStats {
  return {
    id: row.id,
    playthroughSongId: row.playthrough_song_id,
    userId: row.user_id,
    score: row.score,
    notesHit: row.notes_hit,
    notesMissed: row.notes_missed,
    longestStreak: row.longest_streak,
    starsEarned: row.stars_earned,
    accuracyPct: row.accuracy_pct ? parseFloat(row.accuracy_pct) : null,
    difficulty: row.difficulty as Difficulty | null,
    avgMultiplier: row.avg_multiplier ? parseFloat(row.avg_multiplier) : null,
    rating: row.rating,
    createdAt: row.created_at,
  };
}

export async function create(data: CreateStatsData): Promise<PlaythroughSongStats> {
  const row = await queryOne<DbPlaythroughSongStats>(
    `INSERT INTO playthrough_song_stats
     (playthrough_song_id, user_id, score, notes_hit, notes_missed, longest_streak,
      stars_earned, accuracy_pct, rating)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.playthroughSongId,
      data.userId,
      data.score ?? null,
      data.notesHit ?? null,
      data.notesMissed ?? null,
      data.longestStreak ?? null,
      data.starsEarned ?? null,
      data.accuracyPct ?? null,
      data.rating ?? null,
    ]
  );
  return mapToStats(row!);
}

export async function getForPlaythroughSong(
  playthroughSongId: number
): Promise<PlaythroughSongStats[]> {
  const rows = await query<DbPlaythroughSongStats>(
    'SELECT * FROM playthrough_song_stats WHERE playthrough_song_id = $1 ORDER BY created_at',
    [playthroughSongId]
  );
  return rows.map(mapToStats);
}

export async function getForUserAndSong(
  userId: number,
  playthroughSongId: number
): Promise<PlaythroughSongStats | null> {
  const row = await queryOne<DbPlaythroughSongStats>(
    `SELECT * FROM playthrough_song_stats
     WHERE user_id = $1 AND playthrough_song_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, playthroughSongId]
  );
  return row ? mapToStats(row) : null;
}

export async function update(
  id: number,
  data: UpdateStatsData
): Promise<PlaythroughSongStats | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.score !== undefined) {
    sets.push(`score = $${paramIndex++}`);
    values.push(data.score);
  }
  if (data.notesHit !== undefined) {
    sets.push(`notes_hit = $${paramIndex++}`);
    values.push(data.notesHit);
  }
  if (data.notesMissed !== undefined) {
    sets.push(`notes_missed = $${paramIndex++}`);
    values.push(data.notesMissed);
  }
  if (data.longestStreak !== undefined) {
    sets.push(`longest_streak = $${paramIndex++}`);
    values.push(data.longestStreak);
  }
  if (data.starsEarned !== undefined) {
    sets.push(`stars_earned = $${paramIndex++}`);
    values.push(data.starsEarned);
  }
  if (data.accuracyPct !== undefined) {
    sets.push(`accuracy_pct = $${paramIndex++}`);
    values.push(data.accuracyPct);
  }
  if (data.rating !== undefined) {
    sets.push(`rating = $${paramIndex++}`);
    values.push(data.rating);
  }

  if (sets.length === 0) {
    return null;
  }

  values.push(id);
  const row = await queryOne<DbPlaythroughSongStats>(
    `UPDATE playthrough_song_stats SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return row ? mapToStats(row) : null;
}

export async function findById(id: number): Promise<PlaythroughSongStats | null> {
  const row = await queryOne<DbPlaythroughSongStats>(
    'SELECT * FROM playthrough_song_stats WHERE id = $1',
    [id]
  );
  return row ? mapToStats(row) : null;
}

interface DbStatsWithUsername {
  username: string;
  score: number | null;
  accuracy_pct: string | null;
  notes_hit: number | null;
  notes_missed: number | null;
  longest_streak: number | null;
  stars_earned: number | null;
}

export interface StatsWithUsername {
  username: string;
  score: number | null;
  accuracyPct: number | null;
  notesHit: number | null;
  notesMissed: number | null;
  longestStreak: number | null;
  starsEarned: number | null;
}

/**
 * Fetch stats for a playthrough song with usernames joined.
 * Used for broadcasting OCR results via WebSocket.
 */
export async function getStatsWithUsernamesForPlaythroughSong(
  playthroughSongId: number
): Promise<StatsWithUsername[]> {
  const rows = await query<DbStatsWithUsername>(
    `SELECT u.username, s.score, s.accuracy_pct, s.notes_hit, s.notes_missed,
            s.longest_streak, s.stars_earned
     FROM playthrough_song_stats s
     JOIN users u ON s.user_id = u.id
     WHERE s.playthrough_song_id = $1
     ORDER BY s.created_at`,
    [playthroughSongId]
  );

  return rows.map(row => ({
    username: row.username,
    score: row.score,
    accuracyPct: row.accuracy_pct ? parseFloat(row.accuracy_pct) : null,
    notesHit: row.notes_hit,
    notesMissed: row.notes_missed,
    longestStreak: row.longest_streak,
    starsEarned: row.stars_earned,
  }));
}

/**
 * Fetch all stats for a playthrough, ordered by song position and user.
 * Used for the playthrough summary endpoint.
 */
export async function getStatsForPlaythrough(playthroughId: number): Promise<PlaythroughSongStats[]> {
  const rows = await query<DbPlaythroughSongStats>(
    `SELECT pss.*
     FROM playthrough_song_stats pss
     JOIN playthrough_songs ps ON pss.playthrough_song_id = ps.id
     WHERE ps.playthrough_id = $1
     ORDER BY ps.position, pss.user_id`,
    [playthroughId]
  );
  return rows.map(mapToStats);
}
