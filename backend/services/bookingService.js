import pool from "../config/db.js";
import { TIMEZONE } from "./taskService.js";
import { announceNewTask, insertTask } from "../controllers/taskController.js";

// Shared booking logic (Phase 3): one query shape, clash checks, the rule check
// that gives the "Temple AI recommends" line (rule-based until the AI is connected),
// and the prep tasks an approved booking creates.

export const BOOKING_SELECT = `
    SELECT b.*,
           r.name  AS resource_name,
           r.kind  AS resource_kind,
           r.capacity AS resource_capacity,
           requester.full_name AS requested_by_name,
           reviewer.full_name  AS reviewed_by_name,
           (SELECT COUNT(*)::int FROM tasks t WHERE t.booking_id = b.id AND t.status <> 'cancelled') AS task_count
    FROM bookings b
    JOIN resources r ON r.id = b.resource_id
    LEFT JOIN users requester ON requester.id = b.requested_by
    LEFT JOIN users reviewer  ON reviewer.id  = b.reviewed_by`;

export const findBooking = async (id, db = pool) =>
    (await db.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id])).rows[0] ?? null;

// Approved bookings in the same space that overlap [start, end).
export const findClashes = async (resourceId, start, end, excludeId = null, db = pool) =>
    (await db.query(
        `${BOOKING_SELECT}
         WHERE b.resource_id = $1 AND b.status = 'approved'
           AND b.starts_at < $3 AND b.ends_at > $2
           AND b.id IS DISTINCT FROM $4
         ORDER BY b.starts_at`,
        [resourceId, start, end, excludeId]
    )).rows;

// Other requests still waiting for the same space and time (a warning, not a block).
const findPendingOverlaps = async (resourceId, start, end, excludeId, db = pool) =>
    (await db.query(
        `SELECT b.id, b.title, b.starts_at, b.ends_at FROM bookings b
         WHERE b.resource_id = $1 AND b.status = 'pending'
           AND b.starts_at < $3 AND b.ends_at > $2 AND b.id IS DISTINCT FROM $4`,
        [resourceId, start, end, excludeId]
    )).rows;

export const requesterRules = async (db = pool) =>
    (await db.query(
        `SELECT id, text FROM temple_rules WHERE is_active AND ask_requester ORDER BY sort_order, id`
    )).rows;

// Wall-clock hour/minute and weekday of a time in the temple's time zone.
const localParts = (date) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
            .formatToParts(date).map((p) => [p.type, p.value])
    );
    return { minutes: Number(parts.hour) * 60 + Number(parts.minute), weekend: ["Sat", "Sun"].includes(parts.weekday) };
};

// From the Temple Rules: bookings end by 21:00 on weekdays and 22:00 at weekends.
const LATEST_END = { weekday: 21 * 60, weekend: 22 * 60 };

// The rule check behind "Temple AI recommends: Approve – no clashes, all rules agreed".
export const checkBooking = async (booking, db = pool) => {
    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    const clashes = await findClashes(booking.resource_id, start, end, booking.id ?? null, db);
    const pending = await findPendingOverlaps(booking.resource_id, start, end, booking.id ?? null, db);
    const rules = await requesterRules(db);
    const agreed = new Set((booking.rules_agreed ?? []).map(Number));
    const notAgreed = booking.source === "desk" ? [] : rules.filter((r) => !agreed.has(r.id));

    const problems = [];
    if (clashes.length) problems.push(`clashes with "${clashes[0].title}"`);
    if (booking.resource_capacity && booking.guests > booking.resource_capacity) {
        problems.push(`${booking.guests} guests is over the ${booking.resource_capacity} limit`);
    }
    const { minutes, weekend } = localParts(end);
    const latest = weekend ? LATEST_END.weekend : LATEST_END.weekday;
    const endsLate = minutes > latest || minutes === 0 || end.getTime() - start.getTime() > 16 * 3600_000;
    if (endsLate) problems.push(`ends after ${weekend ? "22:00" : "21:00"}`);
    if (notAgreed.length) problems.push(`${notAgreed.length} rule${notAgreed.length > 1 ? "s" : ""} not agreed`);

    const recommendation = problems.length ? "decline" : "approve";
    const summary = problems.length
        ? `Recommend decline · ${problems.join(" · ")}`
        : `Approve · no clashes${booking.source === "desk" ? "" : ", all rules agreed"}`;

    return {
        recommendation,
        summary,
        problems,
        clashes: clashes.map((c) => ({ id: c.id, title: c.title, starts_at: c.starts_at, ends_at: c.ends_at })),
        pending_overlaps: pending,
        rules_total: rules.length,
        rules_agreed: rules.filter((r) => agreed.has(r.id)).length,
        free: clashes.length === 0
    };
};

const PUJA = /(puja|pooja|havan|homam|katha|aarti|abhishek|satyanarayan)/i;

// The tasks approval creates (AC2 "Approving adds these tasks"), drafted from the booking.
export const prepTasksFor = (booking) => {
    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    const at = (base, minutes) => new Date(base.getTime() + minutes * 60_000).toISOString();
    const place = booking.resource_name;
    const tasks = [];
    if (PUJA.test(booking.title)) {
        tasks.push({ title: booking.title, assigned_group: "priest", due_at: at(start, 0), category: "Puja & rituals", requires_verification: false });
    }
    tasks.push({ title: `Clean and prepare ${place}`, assigned_group: "cleaner", due_at: at(start, -60), category: "Cleaning", requires_verification: false });
    if (booking.guests) {
        tasks.push({ title: `Set up ${place} for ${booking.guests} guests`, assigned_group: "caretaker", due_at: at(start, -30), category: "General", requires_verification: false });
    }
    tasks.push({ title: `Check ${place} and lock up`, assigned_group: "security", due_at: at(end, 15), category: "Security & closing", requires_verification: true });
    return tasks;
};

// Create the prep tasks, linked to the booking, and tell the people who'll do them.
export const createPrepTasks = async (booking, actor, db = pool) => {
    const created = [];
    for (const draft of prepTasksFor(booking)) {
        const task = await insertTask({
            title: draft.title,
            description: `For the booking "${booking.title}" (${booking.resource_name})`,
            category: draft.category,
            area: booking.resource_name,
            assigned_to: null,
            assigned_group: draft.assigned_group,
            priority: "normal",
            requires_verification: draft.requires_verification,
            due_at: draft.due_at,
            recurrence: "none"
        }, actor.id, db);
        await db.query("UPDATE tasks SET booking_id = $1 WHERE id = $2", [booking.id, task.id]);
        created.push(task);
    }
    for (const task of created) announceNewTask(task, actor);
    return created;
};
