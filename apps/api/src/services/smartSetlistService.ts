import { query } from '../db/pool.js';
import type { Song, SmartFilter } from '@bearded-nemesis/shared';
import { INSTRUMENTS } from '@bearded-nemesis/shared';
import * as userSongRepo from '../repositories/userSongRepository.js';

interface DbSong {
  id: number;
  slug: string;
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  duration_ms: number | null;
  bpm: number | null;
  genre: string | null;
  cover_art_url: string | null;
  youtube_url: string | null;
  spotify_id: string | null;
  difficulty_drums: number | null;
  difficulty_guitar: number | null;
  difficulty_bass: number | null;
  difficulty_vocals: number | null;
  difficulty_keys: number | null;
  ranking_guitar: number | null;
  ranking_bass: number | null;
  ranking_drums: number | null;
  ranking_vocals: number | null;
  ranking_band: number | null;
  release_date: Date | null;
  harmonies_count: number | null;
  source_array: string[] | null;
}

function mapToSong(row: DbSong): Song {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    artist: row.artist,
    album: row.album,
    year: row.year,
    durationMs: row.duration_ms,
    bpm: row.bpm,
    genre: row.genre,
    coverArtUrl: row.cover_art_url,
    youtubeUrl: row.youtube_url,
    spotifyId: row.spotify_id,
    difficultyDrums: row.difficulty_drums,
    difficultyGuitar: row.difficulty_guitar,
    difficultyBass: row.difficulty_bass,
    difficultyVocals: row.difficulty_vocals,
    difficultyKeys: row.difficulty_keys,
    rankingGuitar: row.ranking_guitar,
    rankingBass: row.ranking_bass,
    rankingDrums: row.ranking_drums,
    rankingVocals: row.ranking_vocals,
    rankingBand: row.ranking_band,
    releaseDate: row.release_date?.toISOString().split('T')[0] ?? null,
    harmoniesCount: row.harmonies_count,
    sourceArray: row.source_array,
  };
}

export async function generateSongList(userId: number, filter: SmartFilter): Promise<Song[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Get owned songs if filtering by owned
  let ownedSongIds: number[] | null = null;
  if (filter.ownedOnly) {
    ownedSongIds = await userSongRepo.getOwnedSongIds(userId);
    if (ownedSongIds.length === 0) {
      return [];
    }
    conditions.push(`s.id = ANY($${paramIndex++})`);
    values.push(ownedSongIds);
  }

  // Difficulty filter (uses first instrument in filter or drums as default)
  const instrument = filter.instruments?.[0] ?? 'drums';
  // Validate instrument to prevent SQL injection
  if (!INSTRUMENTS.includes(instrument as any)) {
    throw new Error(`Invalid instrument: ${instrument}`);
  }
  const diffCol = `difficulty_${instrument}`;

  if (filter.minDifficulty !== undefined) {
    conditions.push(`s.${diffCol} >= $${paramIndex++}`);
    values.push(filter.minDifficulty);
  }

  if (filter.maxDifficulty !== undefined) {
    conditions.push(`s.${diffCol} <= $${paramIndex++}`);
    values.push(filter.maxDifficulty);
  }

  // Rating filter (join with user_songs if needed)
  let joinUserSongs = false;
  if (filter.minRating !== undefined || filter.maxRating !== undefined) {
    joinUserSongs = true;
    if (filter.minRating !== undefined) {
      conditions.push(`us.song_rating >= $${paramIndex++}`);
      values.push(filter.minRating);
    }
    if (filter.maxRating !== undefined) {
      conditions.push(`us.song_rating <= $${paramIndex++}`);
      values.push(filter.maxRating);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build ORDER BY
  let orderBy = 'ORDER BY s.artist, s.title';
  if (filter.sortBy === 'difficulty') {
    orderBy = `ORDER BY s.${diffCol} ${filter.sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
  } else if (filter.sortBy === 'rating') {
    joinUserSongs = true;
    orderBy = `ORDER BY us.song_rating ${filter.sortOrder === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}`;
  } else if (filter.sortBy === 'title') {
    orderBy = `ORDER BY s.title ${filter.sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
  } else if (filter.sortBy === 'artist') {
    orderBy = `ORDER BY s.artist ${filter.sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
  } else if (filter.sortBy === 'random') {
    orderBy = 'ORDER BY RANDOM()';
  }

  let join = '';
  if (joinUserSongs) {
    join = `LEFT JOIN user_songs us ON s.id = us.song_id AND us.user_id = $${paramIndex++}`;
    values.push(userId);
  }

  const sql = `SELECT s.* FROM songs s ${join} ${where} ${orderBy} LIMIT 500`;

  const rows = await query<DbSong>(sql, values);
  return rows.map(mapToSong);
}
