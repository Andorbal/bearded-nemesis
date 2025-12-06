import { query, queryOne } from '../db/pool.js';
import type { Playthrough, PlaythroughStatus } from '@bearded-nemesis/shared';

interface CreatePlaythroughData {
  setlistId: number;
  createdBy: number;
}

interface DbPlaythrough {
  id: number;
  setlist_id: number;
  created_by: number;
  status: PlaythroughStatus;
  current_position: number;
  started_at: Date;
  finished_at: Date | null;
}

function mapToPlaythrough(row: DbPlaythrough): Playthrough {
  return {
    id: row.id,
    setlistId: row.setlist_id,
    createdBy: row.created_by,
    status: row.status,
    currentPosition: row.current_position,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export async function create(data: CreatePlaythroughData): Promise<Playthrough> {
  const row = await queryOne<DbPlaythrough>(
    `INSERT INTO playthroughs (setlist_id, created_by, status, current_position)
     VALUES ($1, $2, 'in_progress', 0)
     RETURNING *`,
    [data.setlistId, data.createdBy]
  );
  return mapToPlaythrough(row!);
}

export async function findById(id: number): Promise<Playthrough | null> {
  const row = await queryOne<DbPlaythrough>(
    'SELECT * FROM playthroughs WHERE id = $1',
    [id]
  );
  return row ? mapToPlaythrough(row) : null;
}

export async function findByUser(userId: number, limit = 50): Promise<Playthrough[]> {
  // Find playthroughs where user is creator or participant
  const rows = await query<DbPlaythrough>(
    `SELECT DISTINCT p.* FROM playthroughs p
     LEFT JOIN playthrough_players pp ON p.id = pp.playthrough_id
     WHERE p.created_by = $1 OR pp.user_id = $1
     ORDER BY p.started_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(mapToPlaythrough);
}

export async function findActive(): Promise<Playthrough[]> {
  const rows = await query<DbPlaythrough>(
    `SELECT * FROM playthroughs
     WHERE status = 'in_progress'
     ORDER BY started_at DESC`,
    []
  );
  return rows.map(mapToPlaythrough);
}

export async function updatePosition(
  id: number,
  position: number
): Promise<Playthrough | null> {
  if (position < 0) {
    return null;
  }

  const row = await queryOne<DbPlaythrough>(
    `UPDATE playthroughs
     SET current_position = $1
     WHERE id = $2 AND status = 'in_progress'
     RETURNING *`,
    [position, id]
  );
  return row ? mapToPlaythrough(row) : null;
}

export async function finish(id: number): Promise<Playthrough | null> {
  const row = await queryOne<DbPlaythrough>(
    `UPDATE playthroughs
     SET status = 'finished', finished_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return row ? mapToPlaythrough(row) : null;
}
