import { query, queryOne } from '../db/pool.js';
import type { PlaythroughPlayer, Instrument, Difficulty } from '@bearded-nemesis/shared';

interface AddPlayerData {
  playthroughId: number;
  userId: number;
  instrument: Instrument;
  difficulty: Difficulty;
  isProMode: boolean;
}

interface DbPlaythroughPlayer {
  playthrough_id: number;
  user_id: number;
  instrument: Instrument;
  difficulty: Difficulty;
  is_pro_mode: boolean;
}

function mapToPlaythroughPlayer(row: DbPlaythroughPlayer): PlaythroughPlayer {
  return {
    playthroughId: row.playthrough_id,
    userId: row.user_id,
    instrument: row.instrument,
    difficulty: row.difficulty,
    isProMode: row.is_pro_mode,
  };
}

export async function addPlayer(data: AddPlayerData): Promise<PlaythroughPlayer> {
  const row = await queryOne<DbPlaythroughPlayer>(
    `INSERT INTO playthrough_players (playthrough_id, user_id, instrument, difficulty, is_pro_mode)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.playthroughId, data.userId, data.instrument, data.difficulty, data.isProMode]
  );
  return mapToPlaythroughPlayer(row!);
}

export async function getPlayers(playthroughId: number): Promise<PlaythroughPlayer[]> {
  const rows = await query<DbPlaythroughPlayer>(
    'SELECT * FROM playthrough_players WHERE playthrough_id = $1',
    [playthroughId]
  );
  return rows.map(mapToPlaythroughPlayer);
}

export async function isPlayer(playthroughId: number, userId: number): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM playthrough_players WHERE playthrough_id = $1 AND user_id = $2) as exists',
    [playthroughId, userId]
  );
  return row?.exists || false;
}

export async function getPlayer(
  playthroughId: number,
  userId: number
): Promise<PlaythroughPlayer | null> {
  const row = await queryOne<DbPlaythroughPlayer>(
    'SELECT * FROM playthrough_players WHERE playthrough_id = $1 AND user_id = $2',
    [playthroughId, userId]
  );
  return row ? mapToPlaythroughPlayer(row) : null;
}
