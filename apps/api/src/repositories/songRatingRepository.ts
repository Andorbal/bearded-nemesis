import { query, queryOne } from '../db/pool.js';
import type { SongRating, Instrument } from '@bearded-nemesis/shared';

export interface CreateRatingData {
  userId: number;
  songId: number;
  instrument: Instrument;
  rating: number;
  playthroughSongId?: number | null;
}

interface DbSongRating {
  id: number;
  user_id: number;
  song_id: number;
  instrument: Instrument;
  rating: number;
  playthrough_song_id: number | null;
  created_at: Date;
}

function mapToSongRating(row: DbSongRating): SongRating {
  return {
    id: row.id,
    userId: row.user_id,
    songId: row.song_id,
    instrument: row.instrument,
    rating: row.rating,
    playthroughSongId: row.playthrough_song_id,
    createdAt: row.created_at,
  };
}

export async function create(data: CreateRatingData): Promise<SongRating> {
  const row = await queryOne<DbSongRating>(
    `INSERT INTO song_ratings (user_id, song_id, instrument, rating, playthrough_song_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.userId, data.songId, data.instrument, data.rating, data.playthroughSongId ?? null]
  );
  return mapToSongRating(row!);
}

export async function getForUserSongInstrument(
  userId: number,
  songId: number,
  instrument: Instrument
): Promise<SongRating[]> {
  const rows = await query<DbSongRating>(
    `SELECT * FROM song_ratings
     WHERE user_id = $1 AND song_id = $2 AND instrument = $3
     ORDER BY created_at DESC`,
    [userId, songId, instrument]
  );
  return rows.map(mapToSongRating);
}

export async function getAverageRating(
  userId: number,
  songId: number,
  instrument: Instrument
): Promise<number | null> {
  const result = await queryOne<{ avg: string | null }>(
    `SELECT AVG(rating)::numeric(3,2) as avg FROM song_ratings
     WHERE user_id = $1 AND song_id = $2 AND instrument = $3`,
    [userId, songId, instrument]
  );
  return result?.avg ? parseFloat(result.avg) : null;
}

export async function getLatestRating(
  userId: number,
  songId: number,
  instrument: Instrument
): Promise<SongRating | null> {
  const row = await queryOne<DbSongRating>(
    `SELECT * FROM song_ratings
     WHERE user_id = $1 AND song_id = $2 AND instrument = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, songId, instrument]
  );
  return row ? mapToSongRating(row) : null;
}

export async function getRecentForUser(userId: number, limit = 50): Promise<SongRating[]> {
  const rows = await query<DbSongRating>(
    `SELECT * FROM song_ratings
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(mapToSongRating);
}
