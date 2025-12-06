import { query, queryOne, pool } from '../db/pool.js';
import type { SetlistSong, Song } from '@bearded-nemesis/shared';

interface DbSetlistSong {
  setlist_id: number;
  song_id: number;
  position: number;
}

interface DbSetlistSongWithDetails extends DbSetlistSong {
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
  release_date: string | null;
  harmonies_count: number | null;
  source_array: string[] | null;
}

function mapToSetlistSong(row: DbSetlistSong): SetlistSong {
  return {
    setlistId: row.setlist_id,
    songId: row.song_id,
    position: row.position,
  };
}

function mapToSong(row: DbSetlistSongWithDetails): Song {
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
    releaseDate: row.release_date,
    harmoniesCount: row.harmonies_count,
    sourceArray: row.source_array,
  };
}

export async function getSongs(setlistId: number): Promise<SetlistSong[]> {
  const rows = await query<DbSetlistSong>(
    'SELECT * FROM setlist_songs WHERE setlist_id = $1 ORDER BY position',
    [setlistId]
  );
  return rows.map(mapToSetlistSong);
}

export async function getSongsWithDetails(setlistId: number): Promise<(SetlistSong & { song: Song })[]> {
  const rows = await query<DbSetlistSongWithDetails>(
    `SELECT ss.setlist_id, ss.song_id, ss.position, s.*
     FROM setlist_songs ss
     JOIN songs s ON ss.song_id = s.id
     WHERE ss.setlist_id = $1
     ORDER BY ss.position`,
    [setlistId]
  );

  return rows.map(row => ({
    setlistId: row.setlist_id,
    songId: row.song_id,
    position: row.position,
    song: mapToSong(row),
  }));
}

export async function addSongs(setlistId: number, songIds: number[]): Promise<void> {
  if (songIds.length === 0) return;

  // Get current max position
  const result = await queryOne<{ max: number | null }>(
    'SELECT MAX(position) as max FROM setlist_songs WHERE setlist_id = $1',
    [setlistId]
  );
  let position = (result?.max ?? -1) + 1;

  const values: unknown[] = [setlistId];
  const placeholders: string[] = [];

  for (const songId of songIds) {
    const idx = values.length;
    values.push(songId, position);
    placeholders.push(`($1, $${idx + 1}, $${idx + 2})`);
    position++;
  }

  await query(
    `INSERT INTO setlist_songs (setlist_id, song_id, position)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (setlist_id, song_id) DO NOTHING`,
    values
  );
}

export async function removeSong(setlistId: number, songId: number): Promise<boolean> {
  const result = await queryOne<{ song_id: number }>(
    'DELETE FROM setlist_songs WHERE setlist_id = $1 AND song_id = $2 RETURNING song_id',
    [setlistId, songId]
  );

  if (result) {
    // Recompact positions
    await query(
      `UPDATE setlist_songs
       SET position = subq.new_pos
       FROM (
         SELECT song_id, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_pos
         FROM setlist_songs WHERE setlist_id = $1
       ) subq
       WHERE setlist_songs.setlist_id = $1 AND setlist_songs.song_id = subq.song_id`,
      [setlistId]
    );
  }

  return result !== null;
}

export async function reorder(setlistId: number, songIds: number[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < songIds.length; i++) {
      await client.query(
        'UPDATE setlist_songs SET position = $1 WHERE setlist_id = $2 AND song_id = $3',
        [i, setlistId, songIds[i]]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function clearSongs(setlistId: number): Promise<void> {
  await query('DELETE FROM setlist_songs WHERE setlist_id = $1', [setlistId]);
}
