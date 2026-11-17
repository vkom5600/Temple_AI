
import pool from "../config/db.js";

export const getAuditLogs = async (req, res) => {
  try {
    const {
      action,
      entity_type,
      limit = "50",
      offset = "0"
    } = req.query;

    const pageLimit = Number(limit);
    const pageOffset = Number(offset);

    if (
      !Number.isInteger(pageLimit) ||
      pageLimit < 1 ||
      pageLimit > 100 ||
      !Number.isInteger(pageOffset) ||
      pageOffset < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit or offset"
      });
    }

    let query = `
      SELECT
        a.id,
        a.actor_id,
        u.full_name AS actor_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.created_at,
        -- Names of what each entry is about, for readable sentences (R2 Activity log)
        COALESCE(t.title, a.details->>'title') AS task_title,
        target.full_name AS target_name,
        att_user.full_name AS attendance_name,
        i.description AS issue_text
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN tasks t ON a.entity_type = 'task' AND t.id = a.entity_id
      LEFT JOIN users target ON a.entity_type = 'user' AND target.id = a.entity_id
      LEFT JOIN attendance att ON a.entity_type = 'attendance' AND att.id = a.entity_id
      LEFT JOIN users att_user ON att_user.id = att.user_id
      LEFT JOIN issues i ON a.entity_type = 'issue' AND i.id = a.entity_id
      WHERE 1 = 1
    `;

    const values = [];

    if (action) {
      values.push(action);
      query += ` AND a.action = $${values.length}`;
    }

    if (entity_type) {
      values.push(entity_type);
      query += ` AND a.entity_type = $${values.length}`;
    }

    // Free-text search over who did it, what they did and what it was about
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (q) {
      values.push(`%${q}%`);
      const n = values.length;
      query += ` AND (u.full_name ILIKE $${n} OR a.action ILIKE $${n} OR t.title ILIKE $${n}` +
        ` OR target.full_name ILIKE $${n} OR att_user.full_name ILIKE $${n} OR i.description ILIKE $${n})`;
    }

    query += " ORDER BY a.created_at DESC, a.id DESC";

    values.push(pageLimit);
    query += ` LIMIT $${values.length}`;

    values.push(pageOffset);
    query += ` OFFSET $${values.length}`;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rowCount,
      auditLogs: result.rows
    });

  } catch (error) {
    console.error("Get audit logs error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve audit logs"
    });
  }
};
