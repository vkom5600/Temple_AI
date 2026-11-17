import pool from "../config/db.js";
import { TASK_GROUPS } from "../services/taskService.js";

const PRIORITIES = ["low", "normal", "high"];
const RECURRENCES = ["none", "daily", "weekly"];

const text = (value, max) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
};

// Validates a task from the admin form (create, edit, or issue -> task).
// Assign to ONE of: assigned_to (a person's id) or assigned_group (a job or role).
// Returns { error } or { data }.
export const validateTaskBody = async (body = {}) => {
    const data = {
        title: text(body.title, 200),
        description: text(body.description, 2000),
        category: text(body.category, 50) ?? "General",
        area: text(body.area, 100),
        assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
        assigned_group: text(body.assigned_group, 30),
        priority: body.priority ?? "normal",
        requires_verification: body.requires_verification === true,
        due_at: body.due_at,
        recurrence: body.recurrence ?? "none"
    };

    if (!data.title) {
        return { error: "Give the task a title" };
    }
    if (Boolean(data.assigned_to) === Boolean(data.assigned_group)) {
        return { error: "Assign the task to one person or one group" };
    }
    if (data.assigned_group && !TASK_GROUPS.includes(data.assigned_group)) {
        return { error: `Group must be one of: ${TASK_GROUPS.join(", ")}` };
    }
    if (data.assigned_to) {
        const person = await pool.query(
            `SELECT id FROM users
             WHERE id = $1 AND is_active AND approval_status = 'approved'`,
            [data.assigned_to]
        );
        if (person.rowCount === 0) {
            return { error: "That person doesn't exist or can't sign in" };
        }
    }
    if (!PRIORITIES.includes(data.priority)) {
        return { error: `Priority must be one of: ${PRIORITIES.join(", ")}` };
    }
    if (!RECURRENCES.includes(data.recurrence)) {
        return { error: `Repeats must be one of: ${RECURRENCES.join(", ")}` };
    }
    if (typeof data.due_at !== "string" || Number.isNaN(Date.parse(data.due_at))) {
        return { error: "Give a valid due date and time" };
    }

    data.due_at = new Date(data.due_at).toISOString();
    return { data };
};
