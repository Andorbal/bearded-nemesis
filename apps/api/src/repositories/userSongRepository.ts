import { query, queryOne } from '../db/pool.js';
import type { UserSong } from '@bearded-nemesis/shared';

export interface CreateUserSongData {
  userId: number;
  songId: number;
  owned?: boolean;
  songRating?: number | null;
}

export interface UpdateUserSongData {
  owned?: boolean;
  songRating?: number | null;
}

interface DbUserSong {
  user_id: number;
  song_id: number;
  owned: boolean;
  song_rating: number | null;
}

function mapToUserSong(row: DbUserSong): UserSong {
  return {
    userId: row.user_id,
    songId: row.song_id,
    owned: row.owned,
    songRating: row.song_rating,
  };
}

export async function get(userId: number, songId: number): Promise<UserSong | null> {
  const row = await queryOne<DbUserSong>(
    'SELECT * FROM user_songs WHERE user_id = $1 AND song_id = $2',
    [userId, songId]
  );
  return row ? mapToUserSong(row) : null;
}

export async function setOwned(userId: number, songId: number, owned: boolean): Promise<UserSong> {
  const row = await queryOne<DbUserSong>(
    `INSERT INTO user_songs (user_id, song_id, owned)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, song_id) DO UPDATE SET owned = $3
     RETURNING *`,
    [userId, songId, owned]
  );
  return mapToUserSong(row!);
}

export async function setSongRating(userId: number, songId: number, rating: number): Promise<UserSong> {
  const row = await queryOne<DbUserSong>(
    `INSERT INTO user_songs (user_id, song_id, song_rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, song_id) DO UPDATE SET song_rating = $3
     RETURNING *`,
    [userId, songId, rating]
  );
  return mapToUserSong(row!);
}

export async function getOwnedSongIds(userId: number): Promise<number[]> {
  const rows = await query<{ song_id: number }>(
    'SELECT song_id FROM user_songs WHERE user_id = $1 AND owned = true',
    [userId]
  );
  return rows.map(r => r.song_id);
}

export async function getUserSongs(userId: number): Promise<UserSong[]> {
  const rows = await query<DbUserSong>(
    'SELECT * FROM user_songs WHERE user_id = $1',
    [userId]
  );
  return rows.map(mapToUserSong);
}

export async function bulkSetOwned(userId: number, songIds: number[], owned: boolean): Promise<void> {
  if (songIds.length === 0) return;

  const values = songIds.map((songId, i) => `($1, $${i + 2}, $${songIds.length + 2})`).join(', ');
  await query(
    `INSERT INTO user_songs (user_id, song_id, owned)
     VALUES ${values}
     ON CONFLICT (user_id, song_id) DO UPDATE SET owned = EXCLUDED.owned`,
    [userId, ...songIds, owned]
  );
}
