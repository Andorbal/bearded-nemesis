import { query, queryOne } from '../db/pool.js';
import type { Setlist, SetlistType, SmartFilter, BuilderPreset } from '@bearded-nemesis/shared';

interface CreateSetlistData {
  userId: number;
  name: string;
  type: SetlistType;
  smartFilter?: SmartFilter | null;
  builderPreset?: BuilderPreset | null;
}

interface UpdateSetlistData {
  name?: string;
  smartFilter?: SmartFilter | null;
  builderPreset?: BuilderPreset | null;
}

interface DbSetlist {
  id: number;
  user_id: number;
  name: string;
  type: SetlistType;
  smart_filter: SmartFilter | null;
  builder_preset: BuilderPreset | null;
  created_at: Date;
  updated_at: Date;
}

function mapToSetlist(row: DbSetlist): Setlist {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    smartFilter: row.smart_filter,
    builderPreset: row.builder_preset,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function create(data: CreateSetlistData): Promise<Setlist> {
  const row = await queryOne<DbSetlist>(
    `INSERT INTO setlists (user_id, name, type, smart_filter, builder_preset)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.userId,
      data.name,
      data.type,
      data.smartFilter ? JSON.stringify(data.smartFilter) : null,
      data.builderPreset ? JSON.stringify(data.builderPreset) : null,
    ]
  );
  return mapToSetlist(row!);
}

export async function findById(id: number): Promise<Setlist | null> {
  const row = await queryOne<DbSetlist>('SELECT * FROM setlists WHERE id = $1', [id]);
  return row ? mapToSetlist(row) : null;
}

export async function findByUserId(userId: number): Promise<Setlist[]> {
  const rows = await query<DbSetlist>(
    'SELECT * FROM setlists WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return rows.map(mapToSetlist);
}

export async function update(id: number, data: UpdateSetlistData): Promise<Setlist | null> {
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.smartFilter !== undefined) {
    sets.push(`smart_filter = $${paramIndex++}`);
    values.push(data.smartFilter ? JSON.stringify(data.smartFilter) : null);
  }
  if (data.builderPreset !== undefined) {
    sets.push(`builder_preset = $${paramIndex++}`);
    values.push(data.builderPreset ? JSON.stringify(data.builderPreset) : null);
  }

  values.push(id);
  const row = await queryOne<DbSetlist>(
    `UPDATE setlists SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return row ? mapToSetlist(row) : null;
}

export async function remove(id: number): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    'DELETE FROM setlists WHERE id = $1 RETURNING id',
    [id]
  );
  return result !== null;
}
