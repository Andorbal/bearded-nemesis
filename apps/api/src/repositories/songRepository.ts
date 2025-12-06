import { query, queryOne } from '../db/pool.js';
import type { Song } from '@bearded-nemesis/shared';

export interface CreateSongData {
  id: number;
  slug: string;
  title: string;
  artist: string;
  album?: string | null;
  year?: number | null;
  durationMs?: number | null;
  bpm?: number | null;
  genre?: string | null;
  coverArtUrl?: string | null;
  youtubeUrl?: string | null;
  spotifyId?: string | null;
  difficultyDrums?: number | null;
  difficultyGuitar?: number | null;
  difficultyBass?: number | null;
  difficultyVocals?: number | null;
  difficultyKeys?: number | null;
  rankingGuitar?: number | null;
  rankingBass?: number | null;
  rankingDrums?: number | null;
  rankingVocals?: number | null;
  rankingBand?: number | null;
  releaseDate?: string | null;
  harmoniesCount?: number | null;
  sourceArray?: string[] | null;
}

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

export interface SearchOptions {
  query?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  instrument?: 'drums' | 'guitar' | 'bass' | 'vocals' | 'keys';
  genre?: string;
  limit?: number;
  offset?: number;
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

export async function create(data: CreateSongData): Promise<Song> {
  const row = await queryOne<DbSong>(
    `INSERT INTO songs (
      id, slug, title, artist, album, year, duration_ms, bpm, genre,
      cover_art_url, youtube_url, spotify_id,
      difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals, difficulty_keys,
      ranking_guitar, ranking_bass, ranking_drums, ranking_vocals, ranking_band,
      release_date, harmonies_count, source_array
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
    ) RETURNING *`,
    [
      data.id, data.slug, data.title, data.artist, data.album ?? null, data.year ?? null,
      data.durationMs ?? null, data.bpm ?? null, data.genre ?? null,
      data.coverArtUrl ?? null, data.youtubeUrl ?? null, data.spotifyId ?? null,
      data.difficultyDrums ?? null, data.difficultyGuitar ?? null, data.difficultyBass ?? null,
      data.difficultyVocals ?? null, data.difficultyKeys ?? null,
      data.rankingGuitar ?? null, data.rankingBass ?? null, data.rankingDrums ?? null,
      data.rankingVocals ?? null, data.rankingBand ?? null,
      data.releaseDate ?? null, data.harmoniesCount ?? null, data.sourceArray ?? null,
    ]
  );
  return mapToSong(row!);
}

export async function findById(id: number): Promise<Song | null> {
  const row = await queryOne<DbSong>('SELECT * FROM songs WHERE id = $1', [id]);
  return row ? mapToSong(row) : null;
}

export async function findBySlug(slug: string): Promise<Song | null> {
  const row = await queryOne<DbSong>('SELECT * FROM songs WHERE slug = $1', [slug]);
  return row ? mapToSong(row) : null;
}

export async function findAll(limit = 100, offset = 0): Promise<Song[]> {
  const rows = await query<DbSong>(
    'SELECT * FROM songs ORDER BY artist, title LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows.map(mapToSong);
}

export async function search(options: SearchOptions): Promise<Song[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (options.query) {
    conditions.push(`(title ILIKE $${paramIndex} OR artist ILIKE $${paramIndex})`);
    values.push(`%${options.query}%`);
    paramIndex++;
  }

  if (options.instrument && options.minDifficulty !== undefined) {
    const col = `difficulty_${options.instrument}`;
    conditions.push(`${col} >= $${paramIndex}`);
    values.push(options.minDifficulty);
    paramIndex++;
  }

  if (options.instrument && options.maxDifficulty !== undefined) {
    const col = `difficulty_${options.instrument}`;
    conditions.push(`${col} <= $${paramIndex}`);
    values.push(options.maxDifficulty);
    paramIndex++;
  }

  if (options.genre) {
    conditions.push(`genre ILIKE $${paramIndex}`);
    values.push(`%${options.genre}%`);
    paramIndex++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  values.push(limit, offset);
  const rows = await query<DbSong>(
    `SELECT * FROM songs ${where} ORDER BY artist, title LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values
  );
  return rows.map(mapToSong);
}

export async function count(): Promise<number> {
  const result = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM songs');
  return parseInt(result?.count ?? '0', 10);
}

export interface UpdateSongData {
  title?: string;
  artist?: string;
  album?: string | null;
  year?: number | null;
  durationMs?: number | null;
  bpm?: number | null;
  genre?: string | null;
  coverArtUrl?: string | null;
  youtubeUrl?: string | null;
  spotifyId?: string | null;
  difficultyDrums?: number | null;
  difficultyGuitar?: number | null;
  difficultyBass?: number | null;
  difficultyVocals?: number | null;
  difficultyKeys?: number | null;
  sourceArray?: string[] | null;
}

export async function update(id: number, data: UpdateSongData): Promise<Song | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    sets.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.artist !== undefined) {
    sets.push(`artist = $${paramIndex++}`);
    values.push(data.artist);
  }
  if (data.album !== undefined) {
    sets.push(`album = $${paramIndex++}`);
    values.push(data.album);
  }
  if (data.year !== undefined) {
    sets.push(`year = $${paramIndex++}`);
    values.push(data.year);
  }
  if (data.durationMs !== undefined) {
    sets.push(`duration_ms = $${paramIndex++}`);
    values.push(data.durationMs);
  }
  if (data.bpm !== undefined) {
    sets.push(`bpm = $${paramIndex++}`);
    values.push(data.bpm);
  }
  if (data.genre !== undefined) {
    sets.push(`genre = $${paramIndex++}`);
    values.push(data.genre);
  }
  if (data.coverArtUrl !== undefined) {
    sets.push(`cover_art_url = $${paramIndex++}`);
    values.push(data.coverArtUrl);
  }
  if (data.youtubeUrl !== undefined) {
    sets.push(`youtube_url = $${paramIndex++}`);
    values.push(data.youtubeUrl);
  }
  if (data.spotifyId !== undefined) {
    sets.push(`spotify_id = $${paramIndex++}`);
    values.push(data.spotifyId);
  }
  if (data.difficultyDrums !== undefined) {
    sets.push(`difficulty_drums = $${paramIndex++}`);
    values.push(data.difficultyDrums);
  }
  if (data.difficultyGuitar !== undefined) {
    sets.push(`difficulty_guitar = $${paramIndex++}`);
    values.push(data.difficultyGuitar);
  }
  if (data.difficultyBass !== undefined) {
    sets.push(`difficulty_bass = $${paramIndex++}`);
    values.push(data.difficultyBass);
  }
  if (data.difficultyVocals !== undefined) {
    sets.push(`difficulty_vocals = $${paramIndex++}`);
    values.push(data.difficultyVocals);
  }
  if (data.difficultyKeys !== undefined) {
    sets.push(`difficulty_keys = $${paramIndex++}`);
    values.push(data.difficultyKeys);
  }
  if (data.sourceArray !== undefined) {
    sets.push(`source_array = $${paramIndex++}`);
    values.push(data.sourceArray);
  }

  if (sets.length === 0) return findById(id);

  values.push(id);
  const row = await queryOne<DbSong>(
    `UPDATE songs SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return row ? mapToSong(row) : null;
}

export async function bulkUpdate(songIds: number[], data: UpdateSongData): Promise<number> {
  if (songIds.length === 0) return 0;

  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    sets.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.artist !== undefined) {
    sets.push(`artist = $${paramIndex++}`);
    values.push(data.artist);
  }
  if (data.album !== undefined) {
    sets.push(`album = $${paramIndex++}`);
    values.push(data.album);
  }
  if (data.year !== undefined) {
    sets.push(`year = $${paramIndex++}`);
    values.push(data.year);
  }
  if (data.durationMs !== undefined) {
    sets.push(`duration_ms = $${paramIndex++}`);
    values.push(data.durationMs);
  }
  if (data.bpm !== undefined) {
    sets.push(`bpm = $${paramIndex++}`);
    values.push(data.bpm);
  }
  if (data.genre !== undefined) {
    sets.push(`genre = $${paramIndex++}`);
    values.push(data.genre);
  }
  if (data.coverArtUrl !== undefined) {
    sets.push(`cover_art_url = $${paramIndex++}`);
    values.push(data.coverArtUrl);
  }
  if (data.youtubeUrl !== undefined) {
    sets.push(`youtube_url = $${paramIndex++}`);
    values.push(data.youtubeUrl);
  }
  if (data.spotifyId !== undefined) {
    sets.push(`spotify_id = $${paramIndex++}`);
    values.push(data.spotifyId);
  }
  if (data.difficultyDrums !== undefined) {
    sets.push(`difficulty_drums = $${paramIndex++}`);
    values.push(data.difficultyDrums);
  }
  if (data.difficultyGuitar !== undefined) {
    sets.push(`difficulty_guitar = $${paramIndex++}`);
    values.push(data.difficultyGuitar);
  }
  if (data.difficultyBass !== undefined) {
    sets.push(`difficulty_bass = $${paramIndex++}`);
    values.push(data.difficultyBass);
  }
  if (data.difficultyVocals !== undefined) {
    sets.push(`difficulty_vocals = $${paramIndex++}`);
    values.push(data.difficultyVocals);
  }
  if (data.difficultyKeys !== undefined) {
    sets.push(`difficulty_keys = $${paramIndex++}`);
    values.push(data.difficultyKeys);
  }
  if (data.sourceArray !== undefined) {
    sets.push(`source_array = $${paramIndex++}`);
    values.push(data.sourceArray);
  }

  if (sets.length === 0) return 0;

  values.push(songIds);
  const result = await query<{ id: number }>(
    `UPDATE songs SET ${sets.join(', ')} WHERE id = ANY($${paramIndex}) RETURNING id`,
    values
  );

  return result.length;
}
