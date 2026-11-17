import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { addComment, findTask, notifyAssignees } from "../services/taskService.js";
import { validateTaskBody } from "../utils/taskValidation.js";
import { parseId } from "../utils/userValidation.js";
import { insertTask, announceNewTask } from "./taskController.js";

const fail = (res, status, message) =>
    res.status(status).json({ success: false, message });

const ISSUE_SELECT = `
    SELECT i.*,
           reporter.full_name AS reported_by_name,
           resolver.full_name AS resolved_by_name,
           task.title         AS task_title,
           task.status        AS task_status,
           new_task.title     AS created_task_title,
           new_task.assigned_group AS created_task_group,
           new_assignee.full_name  AS created_task_assignee_name
    FROM issues i
    LEFT JOIN users reporter     ON reporter.id = i.reported_by
    LEFT JOIN users resolver     ON resolver.id = i.resolved_by
    LEFT JOIN tasks task         ON task.id = i.task_id
    LEFT JOIN tasks new_task     ON new_task.id = i.created_task_id
    LEFT JOIN users new_assignee ON new_assignee.id = new_task.assigned_to
`;

const findIssue = async (id, db = pool) => {
    if (!id) return null;
    const result = await db.query(`${ISSUE_SELECT} WHERE i.id = $1`, [id]);
    return result.rows[0] ?? null;
};

// GET /api/issues?status=open|handled  (admins)
export const getIssues = async (req, res) => {
    const status = req.query.status ?? "open";
    if (!["open", "handled"].includes(status)) return fail(res, 400, "status must be open or handled");

    const result = await pool.query(
        `${ISSUE_SELECT}
         WHERE ${status === "open" ? "i.status = 'open'" : "i.status <> 'open'"}
         ORDER BY ${status === "open" ? "i.created_at" : "i.resolved_at DESC"}
         LIMIT 200`
    );

    res.json({ success: true, count: result.rowCount, issues: result.rows });
};

// POST /api/issues  (anyone signed in)  body: { category, description }
// A general "Report a problem". For "I couldn't do this task" use PATCH /api/tasks/:id/flag.
export const reportIssue = async (req, res) => {
    const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 50) : "";
    const description =
        (typeof req.body?.description === "string" && req.body.description.trim().slice(0, 2000)) ||
        category;

    if (!category) return fail(res, 400, "Say what kind of problem it is");

    const inserted = await pool.query(
        `INSERT INTO issues (reported_by, category, description)
         VALUES ($1, $2, $3) RETURNING id`,
        [req.user.id, category, description]
    );
    const issue = await findIssue(inserted.rows[0].id);

    await logAudit({
        actorId: req.user.id,
        action: "issue.reported",
        entityType: "issue",
        entityId: issue.id,
        details: { category }
    });

    await notify({
        roles: ["chairman", "committee"],
        excludeUserId: req.user.id,
        title: `Problem reported: ${category}`,
        message: `${req.user.full_name}: ${description}`,
        type: "issue"
    });

    res.status(201).json({
        success: true,
        message: "Sent to the chairman and committee",
        issue
    });
};

// PATCH /api/issues/:id/resolve  (admins)  body: { note? }
// Sorted without a new task. If it blocked a task, that task goes back on the list.
export const resolveIssue = async (req, res) => {
    const issue = await findIssue(parseId(req.params.id));
    if (!issue) return fail(res, 404, "Issue not found");
    if (issue.status !== "open") return fail(res, 400, "This issue has already been handled");

    const note = typeof req.body?.note === "string" && req.body.note.trim()
        ? req.body.note.trim().slice(0, 1000)
        : null;

    const client = await pool.connect();
    let reopenedTask = null;

    try {
        await client.query("BEGIN");

        await client.query(
            `UPDATE issues
             SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), resolution_note = $2
             WHERE id = $3`,
            [req.user.id, note, issue.id]
        );

        if (issue.task_id && issue.task_status === "flagged") {
            await client.query("UPDATE tasks SET status = 'todo' WHERE id = $1", [issue.task_id]);
            await addComment(
                issue.task_id,
                req.user.id,
                `Problem sorted${note ? `: ${note}` : ""}. Please try again.`,
                "system",
                client
            );
            reopenedTask = await findTask(issue.task_id, client);
        }

        await logAudit({
            actorId: req.user.id,
            action: "issue.resolved",
            entityType: "issue",
            entityId: issue.id,
            details: { note, reopened_task_id: reopenedTask?.id ?? null }
        }, client);

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    await notify({
        userId: issue.reported_by,
        excludeUserId: req.user.id,
        title: `Sorted: ${issue.category}`,
        message: `${req.user.full_name} marked your report as resolved${note ? `: ${note}` : "."}`,
        type: "issue"
    });

    if (reopenedTask) {
        await notifyAssignees(reopenedTask, {
            title: `Back on your list: ${reopenedTask.title}`,
            message: "The problem has been sorted. Please try again.",
            excludeUserId: req.user.id
        });
    }

    res.json({
        success: true,
        message: reopenedTask ? "Resolved. The task is back on their list." : "Issue resolved",
        issue: await findIssue(issue.id)
    });
};

// POST /api/issues/:id/convert  (admins)  body: a task (same as POST /api/tasks)
export const convertIssue = async (req, res) => {
    const issue = await findIssue(parseId(req.params.id));
    if (!issue) return fail(res, 404, "Issue not found");
    if (issue.status !== "open") return fail(res, 400, "This issue has already been handled");

    const { error, data } = await validateTaskBody(req.body);
    if (error) return fail(res, 400, error);

    const client = await pool.connect();
    let task;

    try {
        await client.query("BEGIN");

        task = await insertTask(data, req.user.id, client);

        await client.query(
            `UPDATE issues
             SET status = 'converted', resolved_by = $1, resolved_at = NOW(), created_task_id = $2
             WHERE id = $3`,
            [req.user.id, task.id, issue.id]
        );

        await logAudit({
            actorId: req.user.id,
            action: "issue.converted",
            entityType: "issue",
            entityId: issue.id,
            details: { task_id: task.id }
        }, client);

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }

    await announceNewTask(task, req.user);

    await notify({
        userId: issue.reported_by,
        excludeUserId: req.user.id,
        title: `Being sorted: ${issue.category}`,
        message: `${req.user.full_name} created a task: "${task.title}".`,
        type: "issue"
    });

    res.status(201).json({
        success: true,
        message: "Task created from the issue",
        issue: await findIssue(issue.id),
        task
    });
};
