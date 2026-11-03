
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
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
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
