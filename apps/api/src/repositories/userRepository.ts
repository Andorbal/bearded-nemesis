import { query, queryOne } from '../db/pool.js';
import type { User } from '@bearded-nemesis/shared';

interface CreateUserData {
  username: string;
  passwordHash: string;
  displayName: string;
  xboxGamertag?: string;
  isAdmin?: boolean;
}

interface DbUser {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  xbox_gamertag: string | null;
  is_admin: boolean;
  created_at: Date;
  deleted_at: Date | null;
}

function mapToUser(row: DbUser): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    xboxGamertag: row.xbox_gamertag,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export async function create(data: CreateUserData): Promise<User> {
  const row = await queryOne<DbUser>(
    `INSERT INTO users (username, password_hash, display_name, xbox_gamertag, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.username, data.passwordHash, data.displayName, data.xboxGamertag ?? null, data.isAdmin ?? false]
  );
  return mapToUser(row!);
}

export async function findById(id: number): Promise<User | null> {
  const row = await queryOne<DbUser>(
    'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return row ? mapToUser(row) : null;
}

export async function findByUsername(username: string): Promise<(User & { passwordHash: string }) | null> {
  const row = await queryOne<DbUser>(
    'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL',
    [username]
  );
  return row ? { ...mapToUser(row), passwordHash: row.password_hash } : null;
}

export async function findAll(): Promise<User[]> {
  const rows = await query<DbUser>('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY username');
  return rows.map(mapToUser);
}

export async function update(id: number, data: Partial<CreateUserData>): Promise<User | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.displayName !== undefined) {
    sets.push(`display_name = $${paramIndex++}`);
    values.push(data.displayName);
  }
  if (data.xboxGamertag !== undefined) {
    sets.push(`xbox_gamertag = $${paramIndex++}`);
    values.push(data.xboxGamertag);
  }
  if (data.isAdmin !== undefined) {
    sets.push(`is_admin = $${paramIndex++}`);
    values.push(data.isAdmin);
  }
  if (data.passwordHash !== undefined) {
    sets.push(`password_hash = $${paramIndex++}`);
    values.push(data.passwordHash);
  }

  if (sets.length === 0) return findById(id);

  values.push(id);
  const row = await queryOne<DbUser>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return row ? mapToUser(row) : null;
}

export async function softDelete(id: number): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
    [id]
  );
  return result !== null;
}

/**
 * Find all users that have an Xbox gamertag set.
 * Used for matching OCR-extracted gamertags to users.
 */
export async function findUsersWithGamertags(): Promise<User[]> {
  const rows = await query<DbUser>(
    'SELECT * FROM users WHERE xbox_gamertag IS NOT NULL AND deleted_at IS NULL ORDER BY username'
  );
  return rows.map(mapToUser);
}

export async function findAllIncludingDeleted(): Promise<User[]> {
  const rows = await query<DbUser>('SELECT * FROM users ORDER BY username');
  return rows.map(mapToUser);
}

export async function restore(id: number): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    'UPDATE users SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id',
    [id]
  );
  return result !== null;
}

export async function countAdmins(): Promise<number> {
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM users WHERE is_admin = true AND deleted_at IS NULL'
  );
  return parseInt(result?.count ?? '0', 10);
}

/**
 * Find multiple users by their IDs in a single query.
 * Returns a Map for O(1) lookups.
 */
export async function findByIds(ids: number[]): Promise<Map<number, User>> {
  if (ids.length === 0) return new Map();

  const rows = await query<DbUser>(
    'SELECT * FROM users WHERE id = ANY($1) AND deleted_at IS NULL',
    [ids]
  );

  const userMap = new Map<number, User>();
  for (const row of rows) {
    const user = mapToUser(row);
    userMap.set(user.id, user);
  }
  return userMap;
}
