import pool from "../config/db.js";

// Record who did what. Every module calls this the same way:
//   await logAudit({ actorId: req.user.id, action: "user.created",
//                    entityType: "user", entityId: user.id, details: { ... } });
// Action names are "<entity>.<past-tense verb>", e.g. "task.completed".
// Never throws: a failed audit write must not break the main operation.
export const logAudit = async ({
  actorId,
  action,
  entityType,
  entityId,
  details = {}
}, db = pool) => {
  try {
    const result = await db.query(
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
  } catch (error) {
    console.error(`Audit log failed (${action}):`, error.message);
    return null;
  }
};

// Older name used by the task and booking controllers.
export const createAuditLog = logAudit;
