import { query, queryOne } from '../db/pool.js';
import type { PlaythroughSong, OcrStatus } from '@bearded-nemesis/shared';

interface DbPlaythroughSong {
  id: number;
  playthrough_id: number;
  song_id: number;
  position: number;
  screenshot_path: string | null;
  ocr_status: OcrStatus | null;
  ocr_error: string | null;
  ocr_processed_at: Date | null;
}

function mapToPlaythroughSong(row: DbPlaythroughSong): PlaythroughSong {
  return {
    id: row.id,
    playthroughId: row.playthrough_id,
    songId: row.song_id,
    position: row.position,
    screenshotPath: row.screenshot_path,
    ocrStatus: row.ocr_status,
    ocrError: row.ocr_error,
    ocrProcessedAt: row.ocr_processed_at,
  };
}

/**
 * Copy songs from a setlist to a playthrough.
 * This creates a snapshot of the setlist at the time the playthrough was created.
 */
export async function copySongsFromSetlist(
  playthroughId: number,
  setlistId: number
): Promise<void> {
  await query(
    `INSERT INTO playthrough_songs (playthrough_id, song_id, position)
     SELECT $1, song_id, position
     FROM setlist_songs
     WHERE setlist_id = $2
     ORDER BY position`,
    [playthroughId, setlistId]
  );
}

export async function getSongs(playthroughId: number): Promise<PlaythroughSong[]> {
  const rows = await query<DbPlaythroughSong>(
    'SELECT * FROM playthrough_songs WHERE playthrough_id = $1 ORDER BY position',
    [playthroughId]
  );
  return rows.map(mapToPlaythroughSong);
}

export async function getSongAtPosition(
  playthroughId: number,
  position: number
): Promise<PlaythroughSong | null> {
  const row = await queryOne<DbPlaythroughSong>(
    'SELECT * FROM playthrough_songs WHERE playthrough_id = $1 AND position = $2',
    [playthroughId, position]
  );
  return row ? mapToPlaythroughSong(row) : null;
}

export async function findById(id: number): Promise<PlaythroughSong | null> {
  const row = await queryOne<DbPlaythroughSong>(
    'SELECT * FROM playthrough_songs WHERE id = $1',
    [id]
  );
  return row ? mapToPlaythroughSong(row) : null;
}

export async function updateScreenshot(
  playthroughSongId: number,
  screenshotPath: string
): Promise<PlaythroughSong | null> {
  const row = await queryOne<DbPlaythroughSong>(
    'UPDATE playthrough_songs SET screenshot_path = $1 WHERE id = $2 RETURNING *',
    [screenshotPath, playthroughSongId]
  );
  return row ? mapToPlaythroughSong(row) : null;
}

export async function countSongs(playthroughId: number): Promise<number> {
  const row = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM playthrough_songs WHERE playthrough_id = $1',
    [playthroughId]
  );
  return parseInt(row?.count || '0', 10);
}

/**
 * Update OCR processing status for a playthrough song.
 */
export async function updateOcrStatus(
  playthroughId: number,
  position: number,
  status: OcrStatus,
  error?: string
): Promise<void> {
  await query(
    `UPDATE playthrough_songs
     SET ocr_status = $1,
         ocr_error = $2,
         ocr_processed_at = CASE WHEN $1::VARCHAR IN ('completed', 'failed') THEN NOW() ELSE NULL END
     WHERE playthrough_id = $3 AND position = $4`,
    [status, error || null, playthroughId, position]
  );
}

/**
 * Clear player stats for a playthrough song (used before OCR retry).
 */
export async function clearPlayerStats(playthroughSongId: number): Promise<void> {
  await query(
    'DELETE FROM playthrough_song_stats WHERE playthrough_song_id = $1',
    [playthroughSongId]
  );
}
