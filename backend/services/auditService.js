
import pool from "../config/db.js";

export const createAuditLog = async ({
  actorId,
  action,
  entityType,
  entityId,
  details = {}
}) => {
  const result = await pool.query(
    `INSERT INTO audit_logs
      (actor_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      actorId ?? null,
      action,
      entityType ?? null,
      entityId ?? null,
      JSON.stringify(details)
    ]
  );

  return result.rows[0];
};
