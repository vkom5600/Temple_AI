import pool from "../config/db.js";
import { logAudit } from "./auditService.js";
import { notify } from "./notificationService.js";
import { DESIGNATIONS } from "../utils/userValidation.js";

// Shared task rules used by the task and issue controllers.

export const TIMEZONE = process.env.TEMPLE_TIMEZONE || "Europe/London";

// Who a task can be given to as a group: any staff job, or a whole role.
export const TASK_GROUPS = [...DESIGNATIONS, "staff", "volunteer", "committee"];

// Who may sign off a safety task (never the person who did it).
export const SIGNOFF_ROLES = ["volunteer", "committee", "chairman"];

export const isAdmin = (user) => ["chairman", "committee"].includes(user.role);

// Is this task given to this user (directly or through their job / role)?
export const isAssignedTo = (task, user) =>
    task.assigned_to === user.id ||
    (task.assigned_group !== null &&
        [user.role, user.designation].includes(task.assigned_group));

// Admins can act on any task; everyone else only on their own.
export const canWorkOn = (task, user) => isAdmin(user) || isAssignedTo(task, user);

// SQL condition: "assigned to the user" given $n = user id, $n+1 = role, $n+2 = designation.
export const assignedToMeSql = (n) =>
    `(t.assigned_to = $${n} OR t.assigned_group = $${n + 1} OR t.assigned_group = $${n + 2})`;

// One query shape for every task the API returns.
export const TASK_SELECT = `
    SELECT t.*,
           assignee.full_name  AS assigned_to_name,
           completer.full_name AS completed_by_name,
           verifier.full_name  AS verified_by_name,
           creator.full_name   AS created_by_name,
           (t.status = 'todo' AND t.due_at < NOW()) AS is_overdue,
           last_comment.comment      AS last_comment,
           last_comment.comment_type AS last_comment_type,
           (SELECT COUNT(*)::int FROM task_comments c WHERE c.task_id = t.id) AS comment_count
    FROM tasks t
    LEFT JOIN users assignee  ON assignee.id  = t.assigned_to
    LEFT JOIN users completer ON completer.id = t.completed_by
    LEFT JOIN users verifier  ON verifier.id  = t.verified_by
    LEFT JOIN users creator   ON creator.id   = t.created_by
    LEFT JOIN LATERAL (
        SELECT comment, comment_type FROM task_comments c
        WHERE c.task_id = t.id
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 1
    ) last_comment ON TRUE
`;

export const findTask = async (id, db = pool) => {
    if (!id) return null;
    const result = await db.query(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    return result.rows[0] ?? null;
};

export const addComment = (taskId, userId, comment, type = "comment", db = pool) =>
    db.query(
        `INSERT INTO task_comments (task_id, user_id, comment, comment_type)
         VALUES ($1, $2, $3, $4)`,
        [taskId, userId, comment, type]
    );

// Notify whoever the task is for: one person, everyone in a job, or a whole role.
export const notifyAssignees = (task, { title, message, type = "task", excludeUserId = null }) => {
    const recipients = task.assigned_to
        ? { userId: task.assigned_to }
        : DESIGNATIONS.includes(task.assigned_group)
            ? { designations: [task.assigned_group] }
            : { roles: [task.assigned_group] };

    return notify({ ...recipients, title, message, type, excludeUserId });
};

// Email addresses of the people a task is for (used by reminders).
export const assigneeEmails = async (task) => {
    const result = await pool.query(
        `SELECT DISTINCT u.email
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.is_active AND u.approval_status = 'approved'
           AND (u.id = $1 OR u.role = $2 OR sp.designation = $2)`,
        [task.assigned_to, task.assigned_group]
    );
    return result.rows.map((row) => row.email);
};

// Create the next copy of every repeating task that is due.
// Looks at the latest copy in each series; if a day (or week) has passed
// in the temple's time zone, adds ONE copy for the most recent due day
// (no pile of backdated copies if the server was off for a while).
// Keeps the same wall-clock time across clock changes.
export const generateRepeatingTasks = async () => {
    const result = await pool.query(
        `WITH latest AS (
            SELECT DISTINCT ON (series_id) *
            FROM tasks
            WHERE series_id IS NOT NULL
            ORDER BY series_id, due_at DESC
         ),
         due AS (
            SELECT l.*,
                   CASE l.recurrence WHEN 'daily' THEN 1 ELSE 7 END AS step_days,
                   ((NOW() AT TIME ZONE $1)::date - (l.due_at AT TIME ZONE $1)::date) AS days_since
            FROM latest l
            WHERE l.recurrence IN ('daily', 'weekly')
         )
         INSERT INTO tasks
            (title, description, category, area, assigned_to, assigned_group,
             priority, requires_verification, recurrence, series_id, created_by, due_at)
         SELECT title, description, category, area, assigned_to, assigned_group,
                priority, requires_verification, recurrence, series_id, created_by,
                (((due_at AT TIME ZONE $1)
                  + make_interval(days => (days_since / step_days) * step_days))
                  AT TIME ZONE $1)
         FROM due
         WHERE days_since >= step_days
         ON CONFLICT DO NOTHING
         RETURNING id, series_id`,
        [TIMEZONE]
    );

    if (result.rowCount > 0) {
        await logAudit({
            actorId: null,
            action: "task.repeats_created",
            entityType: "task",
            details: { task_ids: result.rows.map((row) => row.id) }
        });
    }

    return result.rowCount;
};
