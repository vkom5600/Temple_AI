import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { sendEmail } from "../services/emailService.js";
import * as emails from "../services/emailTemplates.js";
import {
    TASK_SELECT,
    TIMEZONE,
    SIGNOFF_ROLES,
    isAdmin,
    isAssignedTo,
    canWorkOn,
    assignedToMeSql,
    findTask,
    addComment,
    notifyAssignees,
    assigneeEmails
} from "../services/taskService.js";
import { validateTaskBody } from "../utils/taskValidation.js";
import { parseId } from "../utils/userValidation.js";
import { ADMIN_ROLES } from "../middleware/authMiddleware.js";

const MAX_BULK = 50;
const REMIND_GAP_MINUTES = 5;

const fail = (res, status, message) =>
    res.status(status).json({ success: false, message });

const noteFrom = (body, max = 1000) =>
    typeof body?.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, max)
        : null;

// Loads the task from :id or answers 404. Returns null when it already answered.
const loadTask = async (req, res) => {
    const task = await findTask(parseId(req.params.id));
    if (!task) fail(res, 404, "Task not found");
    return task;
};

// Inserts one validated task. Shared by create and "turn an issue into a task".
export const insertTask = async (data, actorId, db = pool) => {
    const inserted = await db.query(
        `INSERT INTO tasks
            (title, description, category, area, assigned_to, assigned_group,
             priority, requires_verification, due_at, recurrence, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [data.title, data.description, data.category, data.area,
         data.assigned_to, data.assigned_group, data.priority,
         data.requires_verification, data.due_at, data.recurrence, actorId]
    );
    const id = inserted.rows[0].id;

    if (data.recurrence !== "none") {
        await db.query("UPDATE tasks SET series_id = id WHERE id = $1", [id]);
    }

    await logAudit({
        actorId,
        action: "task.created",
        entityType: "task",
        entityId: id,
        details: {
            title: data.title,
            assigned_to: data.assigned_to,
            assigned_group: data.assigned_group,
            recurrence: data.recurrence
        }
    }, db);

    return findTask(id, db);
};

export const announceNewTask = (task, actor) =>
    notifyAssignees(task, {
        title: `New task: ${task.title}`,
        message: `From ${actor.full_name}${task.area ? ` · ${task.area}` : ""}`,
        excludeUserId: actor.id
    });

// ---------------------------------------------------------------- reads

// GET /api/tasks
// Admins: ?view=open|overdue|signoff|flagged|done|all|today|mine, &group=, &category=
// Staff / volunteers: their own tasks (today, overdue, next 7 days, done today).
export const getTasks = async (req, res) => {
    const user = req.user;
    const values = [];
    const where = ["TRUE"];
    const add = (sql, ...params) => {
        const start = values.length + 1;
        values.push(...params);
        where.push(sql.replace(/\$(\d+)/g, (_, n) => `$${start + Number(n) - 1}`));
    };

    if (isAdmin(user)) {
        const view = req.query.view ?? "open";
        const views = {
            open: "t.status IN ('todo', 'awaiting_signoff', 'flagged')",
            overdue: "t.status = 'todo' AND t.due_at < NOW()",
            signoff: "t.status = 'awaiting_signoff'",
            flagged: "t.status = 'flagged'",
            done: "t.status = 'done' AND t.completed_at > NOW() - INTERVAL '7 days'",
            all: "t.status <> 'cancelled'"
        };
        if (view === "today") {
            // Everything due today in temple time, plus "any time" tasks (no deadline)
            // that are still open or were finished today.
            add(
                `t.status <> 'cancelled' AND (
                    (t.due_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date
                    OR (t.due_at IS NULL AND (t.status IN ('todo', 'awaiting_signoff', 'flagged')
                        OR (t.completed_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)))`,
                TIMEZONE
            );
        } else if (view === "mine") {
            // The admin's own open tasks ("Your follow-ups"): to them, or to their role.
            add(assignedToMeSql(1), user.id, user.role, user.designation);
            where.push("t.status IN ('todo', 'awaiting_signoff', 'flagged')");
        } else if (views[view]) {
            where.push(views[view]);
        } else {
            return fail(res, 400, `view must be one of: ${[...Object.keys(views), "today", "mine"].join(", ")}`);
        }

        if (req.query.group) add("(t.assigned_group = $1 OR assignee_role.role = $1 OR assignee_job.designation = $1)", req.query.group);
        if (req.query.category) add("t.category = $1", req.query.category);
    } else {
        add(assignedToMeSql(1), user.id, user.role, user.designation);
        add(
            `t.status <> 'cancelled'
             AND (t.due_at IS NULL OR t.due_at < NOW() + INTERVAL '8 days')
             AND (t.status IN ('todo', 'flagged', 'awaiting_signoff')
                  OR (t.completed_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)`,
            TIMEZONE
        );
    }

    const result = await pool.query(
        `${TASK_SELECT}
         LEFT JOIN users assignee_role ON assignee_role.id = t.assigned_to
         LEFT JOIN staff_profiles assignee_job ON assignee_job.user_id = t.assigned_to
         WHERE ${where.join(" AND ")}
         ORDER BY t.due_at NULLS LAST
         LIMIT 500`,
        values
    );

    res.json({ success: true, count: result.rowCount, tasks: result.rows });
};

// GET /api/tasks/summary  (admins) – numbers for the home page and nav badges
export const getSummary = async (req, res) => {
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE today AND status <> 'cancelled')::int                         AS today_total,
            COUNT(*) FILTER (WHERE today AND status IN ('done', 'awaiting_signoff'))::int        AS today_done,
            COUNT(*) FILTER (WHERE status = 'todo' AND due_at < NOW())::int                       AS overdue,
            COUNT(*) FILTER (WHERE status = 'awaiting_signoff')::int                              AS awaiting_signoff,
            COUNT(*) FILTER (WHERE status = 'flagged')::int                                       AS flagged,
            (SELECT COUNT(*)::int FROM issues WHERE status = 'open')                              AS open_issues,
            (SELECT COUNT(*)::int FROM users WHERE approval_status = 'pending')                   AS pending_registrations,
            (SELECT COUNT(*)::int FROM bookings WHERE status = 'pending')                         AS pending_bookings,
            (SELECT COUNT(*)::int FROM questions WHERE answered_at IS NULL)                       AS open_questions
         FROM (
            SELECT status, due_at,
                   COALESCE((due_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date,
                            -- "any time" tasks count while open, or if finished today
                            status IN ('todo', 'awaiting_signoff', 'flagged')
                            OR (completed_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date,
                            FALSE) AS today
            FROM tasks
         ) t`,
        [TIMEZONE]
    );

    res.json({ success: true, summary: result.rows[0] });
};

// GET /api/tasks/signoffs  (volunteers, committee, chairman)
export const getSignoffs = async (req, res) => {
    const result = await pool.query(
        `${TASK_SELECT} WHERE t.status = 'awaiting_signoff' ORDER BY t.completed_at`
    );
    res.json({ success: true, count: result.rowCount, tasks: result.rows });
};

// GET /api/tasks/:id  – with all comments
export const getTaskById = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    const user = req.user;
    const canSee =
        canWorkOn(task, user) ||
        task.completed_by === user.id ||
        (task.status === "awaiting_signoff" && SIGNOFF_ROLES.includes(user.role));

    if (!canSee) return fail(res, 404, "Task not found");

    const comments = await pool.query(
        `SELECT c.id, c.comment, c.comment_type, c.created_at, c.user_id, u.full_name AS user_name
         FROM task_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = $1
         ORDER BY c.created_at, c.id`,
        [task.id]
    );

    res.json({ success: true, task, comments: comments.rows });
};

// ---------------------------------------------------------------- admin writes

// POST /api/tasks  (admins)  body: one task, or { tasks: [...] } to create several
export const createTasks = async (req, res) => {
    const items = Array.isArray(req.body?.tasks) ? req.body.tasks : [req.body];

    if (items.length === 0 || items.length > MAX_BULK) {
        return fail(res, 400, `Send between 1 and ${MAX_BULK} tasks`);
    }

    const validated = [];
    for (const [index, item] of items.entries()) {
        const { error, data } = await validateTaskBody(item);
        if (error) return fail(res, 400, items.length > 1 ? `Task ${index + 1}: ${error}` : error);
        validated.push(data);
    }

    const client = await pool.connect();
    const created = [];

    try {
        await client.query("BEGIN");
        for (const data of validated) {
            created.push(await insertTask(data, req.user.id, client));
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    for (const task of created) await announceNewTask(task, req.user);

    res.status(201).json({
        success: true,
        message: created.length > 1 ? `${created.length} tasks created` : "Task created",
        tasks: created
    });
};

// PUT /api/tasks/:id  (admins) – full replace of the editable fields
export const updateTask = async (req, res) => {
    const before = await loadTask(req, res);
    if (!before) return;

    const { error, data } = await validateTaskBody(req.body);
    if (error) return fail(res, 400, error);

    const client = await pool.connect();
    let task;

    try {
        await client.query("BEGIN");

        await client.query(
            `UPDATE tasks
             SET title = $1, description = $2, category = $3, area = $4,
                 assigned_to = $5, assigned_group = $6, priority = $7,
                 requires_verification = $8, due_at = $9, recurrence = $10
             WHERE id = $11`,
            [data.title, data.description, data.category, data.area,
             data.assigned_to, data.assigned_group, data.priority,
             data.requires_verification, data.due_at, data.recurrence, before.id]
        );

        if (data.recurrence === "none" && before.series_id) {
            // "One time only" stops the whole series.
            await client.query(
                "UPDATE tasks SET recurrence = 'none' WHERE series_id = $1",
                [before.series_id]
            );
        } else if (data.recurrence !== "none" && !before.series_id) {
            await client.query("UPDATE tasks SET series_id = id WHERE id = $1", [before.id]);
        } else if (data.recurrence !== "none") {
            await client.query(
                "UPDATE tasks SET recurrence = $1 WHERE series_id = $2",
                [data.recurrence, before.series_id]
            );
        }

        task = await findTask(before.id, client);

        const changed = Object.fromEntries(
            ["title", "description", "category", "area", "assigned_to", "assigned_group",
             "priority", "requires_verification", "due_at", "recurrence"]
                .filter((key) => String(before[key] ?? "") !== String(task[key] ?? ""))
                .map((key) => [key, { from: before[key], to: task[key] }])
        );

        await logAudit({
            actorId: req.user.id,
            action: "task.updated",
            entityType: "task",
            entityId: task.id,
            details: { changed }
        }, client);

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }

    const reassigned =
        before.assigned_to !== task.assigned_to || before.assigned_group !== task.assigned_group;

    if (reassigned && ["todo", "flagged"].includes(task.status)) {
        await notifyAssignees(task, {
            title: `Task for you: ${task.title}`,
            message: `${req.user.full_name} assigned this to you.`,
            excludeUserId: req.user.id
        });
    }

    res.json({ success: true, message: "Task updated", task });
};

// PATCH /api/tasks/:id/reopen  (admins) – back to "to do"
export const reopenTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (task.status === "todo") return fail(res, 400, "This task is already open");

    await pool.query(
        `UPDATE tasks
         SET status = 'todo', completed_by = NULL, completed_at = NULL,
             verified_by = NULL, verified_at = NULL
         WHERE id = $1`,
        [task.id]
    );
    await addComment(task.id, req.user.id, `Reopened by ${req.user.full_name}`, "system");

    await logAudit({
        actorId: req.user.id,
        action: "task.reopened",
        entityType: "task",
        entityId: task.id,
        details: { from_status: task.status }
    });

    await notifyAssignees(task, {
        title: `Task reopened: ${task.title}`,
        message: `${req.user.full_name} reopened this task.`,
        excludeUserId: req.user.id
    });

    res.json({ success: true, message: "Task reopened", task: await findTask(task.id) });
};

// PATCH /api/tasks/:id/cancel  (admins)  body: { stop_repeating? }
export const cancelTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (task.status === "cancelled") return fail(res, 400, "This task is already cancelled");

    const stopRepeating = req.body?.stop_repeating === true && task.series_id;

    await pool.query("UPDATE tasks SET status = 'cancelled' WHERE id = $1", [task.id]);

    if (stopRepeating) {
        await pool.query("UPDATE tasks SET recurrence = 'none' WHERE series_id = $1", [task.series_id]);
    }

    await logAudit({
        actorId: req.user.id,
        action: "task.cancelled",
        entityType: "task",
        entityId: task.id,
        details: { from_status: task.status, stopped_repeating: Boolean(stopRepeating) }
    });

    res.json({
        success: true,
        message: stopRepeating ? "Task cancelled and won't repeat" : "Task cancelled",
        task: await findTask(task.id)
    });
};

// POST /api/tasks/:id/remind  (admins) – bell + email to whoever it's for
export const remindTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (!["todo", "flagged"].includes(task.status)) {
        return fail(res, 400, "Only open tasks can be reminded");
    }

    if (task.last_reminded_at &&
        Date.now() - new Date(task.last_reminded_at).getTime() < REMIND_GAP_MINUTES * 60_000) {
        return fail(res, 429, `A reminder was sent less than ${REMIND_GAP_MINUTES} minutes ago`);
    }

    await pool.query(
        `UPDATE tasks
         SET last_reminded_at = NOW(), reminder_count = reminder_count + 1, last_reminded_by = $2
         WHERE id = $1`,
        [task.id, req.user.id]
    );

    const sent = await notifyAssignees(task, {
        title: `Reminder: ${task.title}`,
        message: `${req.user.full_name} sent a reminder. ${task.is_overdue ? "This task is overdue." : ""}`.trim(),
        excludeUserId: req.user.id
    });

    const email = emails.taskReminder(task, req.user);
    for (const to of await assigneeEmails(task)) {
        if (to !== req.user.email) await sendEmail({ to, ...email });
    }

    await logAudit({
        actorId: req.user.id,
        action: "task.reminded",
        entityType: "task",
        entityId: task.id,
        details: { recipients: sent.length }
    });

    res.json({
        success: true,
        message: sent.length ? `Reminder sent to ${sent.length} ${sent.length === 1 ? "person" : "people"}` : "Nobody to remind: no active person has this task",
        task: await findTask(task.id)
    });
};

// ---------------------------------------------------------------- doing the work

// PATCH /api/tasks/:id/complete  body: { note? }
// Safety tasks go to "awaiting_signoff"; everything else is done.
export const completeTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (!canWorkOn(task, req.user)) return fail(res, 403, "This task isn't assigned to you");
    if (task.status !== "todo") return fail(res, 400, "Only tasks still to do can be marked done");

    const newStatus = task.requires_verification ? "awaiting_signoff" : "done";

    await pool.query(
        `UPDATE tasks
         SET status = $1, completed_by = $2, completed_at = NOW()
         WHERE id = $3 AND status = 'todo'`,
        [newStatus, req.user.id, task.id]
    );

    const note = noteFrom(req.body);
    if (note) await addComment(task.id, req.user.id, note);

    await logAudit({
        actorId: req.user.id,
        action: "task.completed",
        entityType: "task",
        entityId: task.id,
        details: { status: newStatus }
    });

    if (newStatus === "awaiting_signoff") {
        await notify({
            roles: SIGNOFF_ROLES,
            excludeUserId: req.user.id,
            title: `Please check and sign off: ${task.title}`,
            message: `${req.user.full_name} marked this safety task done${task.area ? ` (${task.area})` : ""}.`,
            type: "signoff"
        });
    }

    res.json({
        success: true,
        message: newStatus === "done" ? "Marked as done" : "Done. Someone will check and sign it off.",
        task: await findTask(task.id)
    });
};

// PATCH /api/tasks/:id/undo – the person who ticked it (or an admin), before sign-off
export const undoTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (!["done", "awaiting_signoff"].includes(task.status) || task.verified_by) {
        return fail(res, 400, "Only a task marked done (and not yet signed off) can be undone");
    }
    if (task.completed_by !== req.user.id && !isAdmin(req.user)) {
        return fail(res, 403, "Only the person who marked it done can undo it");
    }

    await pool.query(
        `UPDATE tasks
         SET status = 'todo', completed_by = NULL, completed_at = NULL
         WHERE id = $1`,
        [task.id]
    );

    await logAudit({
        actorId: req.user.id,
        action: "task.undone",
        entityType: "task",
        entityId: task.id
    });

    res.json({ success: true, message: "Back on your list", task: await findTask(task.id) });
};

// PATCH /api/tasks/:id/verify – sign off a safety task (not your own)
export const verifyTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (task.status !== "awaiting_signoff") return fail(res, 400, "This task isn't waiting for sign-off");
    if (task.completed_by === req.user.id) {
        return fail(res, 403, "You did this task, so someone else needs to check it");
    }

    await pool.query(
        `UPDATE tasks
         SET status = 'done', verified_by = $1, verified_at = NOW()
         WHERE id = $2 AND status = 'awaiting_signoff'`,
        [req.user.id, task.id]
    );

    await logAudit({
        actorId: req.user.id,
        action: "task.verified",
        entityType: "task",
        entityId: task.id,
        details: { completed_by: task.completed_by }
    });

    await notify({
        userId: task.completed_by,
        title: `Signed off: ${task.title}`,
        message: `${req.user.full_name} checked and signed off your task.`,
        type: "signoff"
    });

    res.json({ success: true, message: "Signed off. Task closed.", task: await findTask(task.id) });
};

// PATCH /api/tasks/:id/send-back  body: { note } – sign-off refused
export const sendBackTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    const note = noteFrom(req.body);
    if (!note) return fail(res, 400, "Say what's wrong so they can fix it");
    if (task.status !== "awaiting_signoff") return fail(res, 400, "This task isn't waiting for sign-off");
    if (task.completed_by === req.user.id) {
        return fail(res, 403, "You did this task, so someone else needs to check it");
    }

    await pool.query(
        `UPDATE tasks
         SET status = 'todo', completed_by = NULL, completed_at = NULL
         WHERE id = $1`,
        [task.id]
    );
    await addComment(task.id, req.user.id, note, "sent_back");

    await logAudit({
        actorId: req.user.id,
        action: "task.sent_back",
        entityType: "task",
        entityId: task.id,
        details: { note, completed_by: task.completed_by }
    });

    await notify({
        userId: task.completed_by,
        title: `Sent back: ${task.title}`,
        message: `${req.user.full_name}: ${note}`,
        type: "signoff"
    });

    res.json({
        success: true,
        message: `Sent back to ${task.completed_by_name ?? "them"}`,
        task: await findTask(task.id)
    });
};

// PATCH /api/tasks/:id/flag  body: { category, description } – "Can't do this"
export const flagTask = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    if (!canWorkOn(task, req.user)) return fail(res, 403, "This task isn't assigned to you");
    if (task.status !== "todo") return fail(res, 400, "Only tasks still to do can be reported");

    const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 50) : "";
    const description =
        (typeof req.body?.description === "string" && req.body.description.trim().slice(0, 2000)) ||
        category;
    if (!category) return fail(res, 400, "Say what happened");

    const client = await pool.connect();
    let issueId;

    try {
        await client.query("BEGIN");
        await client.query("UPDATE tasks SET status = 'flagged' WHERE id = $1", [task.id]);
        await addComment(task.id, req.user.id, description, "flagged", client);

        const issue = await client.query(
            `INSERT INTO issues (reported_by, task_id, category, description)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [req.user.id, task.id, category, description]
        );
        issueId = issue.rows[0].id;

        await logAudit({
            actorId: req.user.id,
            action: "task.flagged",
            entityType: "task",
            entityId: task.id,
            details: { issue_id: issueId, category }
        }, client);

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    await notify({
        roles: ["chairman", "committee"],
        excludeUserId: req.user.id,
        title: `Couldn't do: ${task.title}`,
        message: `${req.user.full_name}: ${description}`,
        type: "issue"
    });

    res.json({
        success: true,
        message: "Sent to the chairman and committee",
        task: await findTask(task.id),
        issue_id: issueId
    });
};

// POST /api/tasks/:id/comments  body: { comment }
export const addTaskComment = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;

    const canComment =
        canWorkOn(task, req.user) ||
        task.completed_by === req.user.id ||
        (task.status === "awaiting_signoff" && SIGNOFF_ROLES.includes(req.user.role));
    if (!canComment) return fail(res, 404, "Task not found");

    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 1000) : "";
    if (!comment) return fail(res, 400, "Write a comment first");

    await addComment(task.id, req.user.id, comment);

    // Let the admin who created it know when staff write something.
    if (task.created_by && task.created_by !== req.user.id && isAssignedTo(task, req.user)) {
        await notify({
            userId: task.created_by,
            title: `Comment on: ${task.title}`,
            message: `${req.user.full_name}: ${comment}`,
            type: "task"
        });
    } else if (ADMIN_ROLES.includes(req.user.role) && !isAssignedTo(task, req.user)) {
        // An admin replying (T6 "Reply to Ramesh"): it goes to the people doing the task.
        await notifyAssignees(task, {
            title: `Message about: ${task.title}`,
            message: `${req.user.full_name}: ${comment}`,
            excludeUserId: req.user.id
        });
    }

    res.status(201).json({ success: true, message: "Comment added" });
};
