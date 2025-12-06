import { query } from '../db/pool.js';

export interface AuditLogEntry {
  adminUserId: number;
  action: string;
  entityType: string;
  entityId: number;
  changes?: Record<string, unknown>;
}

export async function log(entry: AuditLogEntry): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, changes)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.adminUserId, entry.action, entry.entityType, entry.entityId, entry.changes ? JSON.stringify(entry.changes) : null]
  );
}

export async function getForEntity(entityType: string, entityId: number): Promise<unknown[]> {
  const rows = await query(
    `SELECT * FROM admin_audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return rows;
}
