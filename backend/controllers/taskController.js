
import pool from "../config/db.js";
import { createAuditLog } from "../services/auditService.js";
import {
  sendNotificationSafely,
  notifyRolesSafely
} from "../services/notificationService.js";
// Create and assign a task
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      task_type,
      assigned_to,
      priority,
      due_at,
      requires_verification
    } = req.body;

    if (!title || !assigned_to) {
      return res.status(400).json({
        success: false,
        message: "Task title and assigned staff are required"
      });
    }

    const staff = await pool.query(
      `SELECT id, role, is_active
       FROM users WHERE id = $1`,
      [assigned_to]
    );

    if (
      staff.rows.length === 0 ||
      !staff.rows[0].is_active ||
      !["staff", "volunteer"].includes(staff.rows[0].role)
    ) await sendNotificationSafely({
  userId: result.rows[0].assigned_to,
  title: "New Task Assigned",
  message: `You have been assigned a new task: ${result.rows[0].title}. Priority: ${result.rows[0].priority}.`
});{
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive staff/volunteer account"
      });
    }

    const result = await pool.query(
      `INSERT INTO tasks
       (title, description, task_type, assigned_to,
        created_by, priority, due_at, requires_verification, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'assigned')
       RETURNING *`,
      [
        title,
        description || null,
        task_type || "general",
        assigned_to,
        req.user.id,
        priority || "medium",
        due_at || null,
        requires_verification ?? true
      ]
    );

try {
  await createAuditLog({
    actorId: req.user.id,
    action: "TASK_CREATED",
    entityType: "task",
    entityId: result.rows[0].id,
    details: {
      title: result.rows[0].title,
      assignedTo: result.rows[0].assigned_to,
      priority: result.rows[0].priority
    }
  });
} catch (auditError) {
  console.error("Task creation audit error:", auditError);
}
    res.status(201).json({
      success: true,
      message: "Task created and assigned successfully",
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create task"
    });
  }
};

// Get tasks according to user role
export const getTasks = async (req, res) => {
  try {
    const { status, priority, assigned_to } = req.query;

    let query = `
      SELECT t.*,
             assignee.full_name AS assigned_staff_name,
             creator.full_name AS created_by_name
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE 1=1
    `;

    const values = [];

    // Staff and volunteers can see only their own tasks
    if (["staff", "volunteer"].includes(req.user.role)) {
      values.push(req.user.id);
      query += ` AND t.assigned_to = $${values.length}`;
    } else if (assigned_to) {
      values.push(assigned_to);
      query += ` AND t.assigned_to = $${values.length}`;
    }

    if (status) {
      values.push(status);
      query += ` AND t.status = $${values.length}`;
    }

    if (priority) {
      values.push(priority);
      query += ` AND t.priority = $${values.length}`;
    }

    query += " ORDER BY t.created_at DESC";

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rowCount,
      tasks: result.rows
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve tasks"
    });
  }
};

// Staff submits a completed task for verification
export const submitTask = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE tasks
       SET status = 'pending_verification',
           completed_at = NOW()
       WHERE id = $1
         AND assigned_to = $2
         AND status = 'assigned'
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Task not found, not assigned to you, or already submitted"
      });
    }
try {
  await createAuditLog({
    actorId: req.user.id,
    action: "TASK_SUBMITTED",
    entityType: "task",
    entityId: result.rows[0].id,
    details: {
      title: result.rows[0].title,
      status: result.rows[0].status
    }
  });
} catch (auditError) {
  console.error("Task submission audit error:", auditError);
}
await notifyRolesSafely({
  roles: ["chairman", "committee"],
  title: "Task Submitted for Verification",
  message: `Task "${result.rows[0].title}" has been submitted for verification by ${req.user.full_name || "a staff member"}.`
});
    res.json({
      success: true,
      message: "Task submitted for verification",
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Submit task error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to submit task"
    });
  }
};

// Chairman or Committee verifies a completed task
export const verifyTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be approved or rejected"
      });
    }

    const newStatus =
      decision === "approved" ? "approved" : "assigned";

    const result = await pool.query(
      `UPDATE tasks
       SET status = $1,
           verified_by = $2,
           verified_at = NOW()
       WHERE id = $3
         AND status = 'pending_verification'
       RETURNING *`,
      [newStatus, req.user.id, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found or not awaiting verification"
      });
    }
try {
  await createAuditLog({
    actorId: req.user.id,
    action: decision === "approved"
      ? "TASK_APPROVED"
      : "TASK_REJECTED",
    entityType: "task",
    entityId: result.rows[0].id,
    details: {
      title: result.rows[0].title,
      decision,
      newStatus: result.rows[0].status
    }
  });
} catch (auditError) {
  console.error("Task verification audit error:", auditError);
}
await sendNotificationSafely({
  userId: result.rows[0].assigned_to,
  title: decision === "approved"
    ? "Task Approved"
    : "Task Requires Further Work",
  message: decision === "approved"
    ? `Your task "${result.rows[0].title}" has been approved.`
    : `Your task "${result.rows[0].title}" was returned for further work. Please review and complete it again.`
});
    res.json({
      success: true,
      message: `Task ${decision} successfully`,
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Verify task error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to verify task"
    });
  }
};
