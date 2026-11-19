import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { draftPlan } from "../services/planService.js";
import { findBooking, findClashes } from "../services/bookingService.js";
import { announceNewTask, insertTask } from "./taskController.js";
import { validateTaskBody } from "../utils/taskValidation.js";
import { validateBooking } from "./bookingController.js";

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

// POST /api/plans/draft  { messages: string[], asked?: string[] }   (AI2 chat)
// Reads the conversation so far and replies with a question or a draft plan.
export const draft = async (req, res) => {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12).map((m) => String(m).slice(0, 500)) : [];
    const asked = Array.isArray(req.body?.asked) ? req.body.asked.map(String) : [];
    res.json({ success: true, ...(await draftPlan({ messages, asked })) });
};

// POST /api/plans/confirm  { event: {...}, tasks: [...] }   (AI2 "Confirm plan")
// Adds the event to the Calendar, creates the tasks linked to it and tells the people assigned.
export const confirm = async (req, res) => {
    const { event, tasks } = req.body ?? {};
    if (!event || !Array.isArray(tasks)) return fail(res, 400, "Send the event and its tasks");
    if (tasks.length > 40) return fail(res, 400, "That's a lot of tasks. Keep it to 40 or fewer.");

    const { data, error } = await validateBooking({ ...event, kind: "event", food: false }, req.user);
    if (error) return fail(res, 400, error);

    const checked = [];
    for (const [i, t] of tasks.entries()) {
        const { data: task, error: taskError } = await validateTaskBody({ ...t, area: t.area ?? data.resource.name, recurrence: "none", priority: t.priority ?? "normal" });
        if (taskError) return fail(res, 400, `Task ${i + 1} ("${t.title ?? ""}"): ${taskError}`);
        checked.push(task);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(42, $1)", [data.resource_id]);
        const clashes = await findClashes(data.resource_id, data.starts_at, data.ends_at, null, client);
        if (clashes.length) {
            await client.query("ROLLBACK");
            return fail(res, 409, `${data.resource.name} is already booked then ("${clashes[0].title}"). Pick another space or time.`);
        }
        const inserted = await client.query(
            `INSERT INTO bookings (resource_id, kind, title, starts_at, ends_at, guests, contact_name, notes,
                                   status, source, requested_by, rules_agreed, reviewed_by, reviewed_at)
             VALUES ($1, 'event', $2, $3, $4, $5, $6, $7, 'approved', 'desk', $8, '[]', $8, NOW())
             RETURNING id`,
            [data.resource_id, data.title, data.starts_at, data.ends_at, data.guests, req.user.full_name, data.notes, req.user.id]
        );
        const bookingId = inserted.rows[0].id;
        const created = [];
        for (const task of checked) {
            const t = await insertTask(task, req.user.id, client);
            await client.query("UPDATE tasks SET booking_id = $1 WHERE id = $2", [bookingId, t.id]);
            created.push(t);
        }
        await logAudit({
            actorId: req.user.id,
            action: "plan.confirmed",
            entityType: "booking",
            entityId: bookingId,
            details: { title: data.title, resource: data.resource.name, starts_at: data.starts_at, tasks: created.length }
        }, client);
        await client.query("COMMIT");

        for (const t of created) announceNewTask(t, req.user);
        res.status(201).json({
            success: true,
            booking: await findBooking(bookingId),
            tasks: created.length,
            message: `${data.title} is on the Calendar with ${created.length} task${created.length === 1 ? "" : "s"}. The people assigned have been told.`
        });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
};
