import pg from 'pg';
import { loadConfig } from '../config.js';

const config = loadConfig();

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
