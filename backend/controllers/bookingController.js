import pool from "../config/db.js";
import { ADMIN_ROLES } from "../middleware/authMiddleware.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { chairmanEmails, sendEmail } from "../services/emailService.js";
import * as emails from "../services/emailTemplates.js";
import {
    BOOKING_SELECT, checkBooking, createPrepTasks, findBooking, findClashes, prepTasksFor, requesterRules
} from "../services/bookingService.js";
import { parseId } from "../utils/userValidation.js";

// Phase 3 bookings (designs M7, M13, AC2, C1, C3, C4).
//   mobile: staff and volunteers request a space; it waits for approval
//   desk:   the chairman / committee book from the tablet; confirmed at once
// (Replaces the first draft, which used a free-text resource name.)

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
const isAdmin = (user) => ADMIN_ROLES.includes(user.role);
const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Check and tidy a booking from the request body. Returns { data } or { error }.
const validateBooking = async (body, user) => {
    const resourceId = parseId(body.resource_id);
    if (!resourceId) return { error: "Choose a hall or room" };
    const resource = (await pool.query("SELECT * FROM resources WHERE id = $1 AND is_active", [resourceId])).rows[0];
    if (!resource) return { error: "That hall or room isn't available" };

    const title = text(body.title, 200);
    if (!title) return { error: "Say what the booking is for" };

    const start = new Date(body.starts_at);
    const end = new Date(body.ends_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: "Give a valid date and time" };
    if (end <= start) return { error: "The end time must be after the start time" };
    if (start < new Date(Date.now() - 5 * 60_000)) return { error: "That time has already passed" };

    const guests = body.guests === undefined || body.guests === null || body.guests === "" ? null : Number(body.guests);
    if (guests !== null && (!Number.isInteger(guests) || guests < 0 || guests > 5000)) return { error: "Guests must be a whole number" };

    const kind = body.kind === "event" ? "event" : "booking";
    if (kind === "event" && !isAdmin(user)) return { error: "Only the chairman or committee can add temple events" };

    const rulesAgreed = Array.isArray(body.rules_agreed) ? [...new Set(body.rules_agreed.map(Number).filter(Number.isInteger))] : [];

    return {
        data: {
            resource,
            resource_id: resourceId,
            kind,
            title,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            guests,
            food: Boolean(body.food),
            contact_name: text(body.contact_name, 120) ?? user.full_name,
            contact_phone: text(body.contact_phone, 30) ?? user.phone ?? null,
            contact_email: text(body.contact_email, 255),
            organisation: text(body.organisation, 120),
            notes: text(body.notes, 2000),
            deposit_paid: Boolean(body.deposit_paid),
            rules_agreed: rulesAgreed
        }
    };
};

// ---------------------------------------------------------------- reads

// GET /api/bookings?from=&to=&status=   admins: everything; others: their own requests
export const getBookings = async (req, res) => {
    const values = [];
    const where = ["TRUE"];
    const add = (sql, value) => { values.push(value); where.push(sql.replace("$?", `$${values.length}`)); };

    if (!isAdmin(req.user)) add("b.requested_by = $?", req.user.id);
    if (req.query.from) add("b.ends_at >= $?", new Date(req.query.from));
    if (req.query.to) add("b.starts_at < $?", new Date(req.query.to));
    if (req.query.status) add("b.status = $?", String(req.query.status));
    if (req.query.resource_id) add("b.resource_id = $?", Number(req.query.resource_id));

    const result = await pool.query(`${BOOKING_SELECT} WHERE ${where.join(" AND ")} ORDER BY b.starts_at LIMIT 1000`, values);
    res.json({ success: true, count: result.rowCount, bookings: result.rows });
};

// GET /api/bookings/schedule?date=YYYY-MM-DD   everyone: confirmed bookings and events that day
// ("Today at the temple" on the staff phone, "Today at the mandir" on Home)
export const getSchedule = async (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date ?? "")) ? req.query.date : null;
    const result = await pool.query(
        `SELECT b.id, b.kind, b.title, b.starts_at, b.ends_at, r.name AS resource_name
         FROM bookings b JOIN resources r ON r.id = b.resource_id
         WHERE b.status = 'approved'
           AND (b.starts_at AT TIME ZONE $2)::date = COALESCE($1::date, (NOW() AT TIME ZONE $2)::date)
         ORDER BY b.starts_at`,
        [date, process.env.TEMPLE_TIMEZONE || "Europe/London"]
    );
    res.json({ success: true, bookings: result.rows });
};

// GET /api/bookings/:id   admins (with the rule check and the prep tasks approval would add) or the requester
export const getBooking = async (req, res) => {
    const id = parseId(req.params.id);
    const booking = id && await findBooking(id);
    if (!booking || (!isAdmin(req.user) && booking.requested_by !== req.user.id)) return fail(res, 404, "Booking not found");

    const rules = await requesterRules();
    const agreed = new Set((booking.rules_agreed ?? []).map(Number));
    const response = { success: true, booking, rules: rules.map((r) => ({ ...r, agreed: agreed.has(r.id) })) };
    if (isAdmin(req.user)) {
        response.check = await checkBooking(booking);
        response.prep_tasks = booking.status === "pending" ? prepTasksFor(booking) : [];
        response.tasks = (await pool.query(
            "SELECT id, title, status, assigned_group, due_at FROM tasks WHERE booking_id = $1 ORDER BY due_at", [booking.id]
        )).rows;
    }
    res.json(response);
};

// POST /api/bookings/check  { resource_id, starts_at, ends_at, guests? }  – "Community Hall is free…" (C4, M7)
export const checkAvailability = async (req, res) => {
    const resourceId = parseId(req.body?.resource_id);
    const start = new Date(req.body?.starts_at);
    const end = new Date(req.body?.ends_at);
    if (!resourceId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return fail(res, 400, "Choose a space and a valid time");
    }
    const resource = (await pool.query("SELECT * FROM resources WHERE id = $1", [resourceId])).rows[0];
    if (!resource) return fail(res, 404, "That hall or room doesn't exist");
    const check = await checkBooking({
        resource_id: resourceId, resource_capacity: resource.capacity, starts_at: start, ends_at: end,
        guests: Number(req.body?.guests) || null, source: "desk", rules_agreed: []
    });
    res.json({ success: true, free: check.free, clashes: check.clashes, problems: check.problems });
};

// ---------------------------------------------------------------- writes

// POST /api/bookings
// Staff / volunteers (mobile): a request, which must agree to every Temple Rule (M7 "6 of 6").
// Chairman / committee (desk, C4): confirmed straight away; { notify_staff: true } adds the prep tasks.
export const createBooking = async (req, res) => {
    const { data, error } = await validateBooking(req.body ?? {}, req.user);
    if (error) return fail(res, 400, error);
    const desk = isAdmin(req.user);

    if (!desk) {
        const rules = await requesterRules();
        const missing = rules.filter((r) => !data.rules_agreed.includes(r.id));
        if (missing.length) return fail(res, 400, `Please agree to all ${rules.length} Temple Rules first`);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // One booking at a time per space, so two people can't take the same slot.
        await client.query("SELECT pg_advisory_xact_lock(42, $1)", [data.resource_id]);
        const clashes = await findClashes(data.resource_id, data.starts_at, data.ends_at, null, client);
        if (clashes.length) {
            await client.query("ROLLBACK");
            return fail(res, 409, `${data.resource.name} is already booked then ("${clashes[0].title}")`, { clashes });
        }

        const inserted = await client.query(
            `INSERT INTO bookings
                (resource_id, kind, title, starts_at, ends_at, guests, food, contact_name, contact_phone,
                 contact_email, organisation, notes, deposit_paid, status, source, requested_by,
                 rules_agreed, rules_agreed_at, reviewed_by, reviewed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
             RETURNING id`,
            [data.resource_id, data.kind, data.title, data.starts_at, data.ends_at, data.guests, data.food,
             data.contact_name, data.contact_phone, data.contact_email, data.organisation, data.notes, data.deposit_paid,
             desk ? "approved" : "pending", desk ? "desk" : "mobile", req.user.id,
             JSON.stringify(data.rules_agreed), desk ? null : new Date(),
             desk ? req.user.id : null, desk ? new Date() : null]
        );
        const booking = await findBooking(inserted.rows[0].id, client);
        if (desk && req.body?.notify_staff) await createPrepTasks(booking, req.user, client);

        await logAudit({
            actorId: req.user.id,
            action: desk ? "booking.created" : "booking.requested",
            entityType: "booking",
            entityId: booking.id,
            details: { title: booking.title, resource: booking.resource_name, starts_at: booking.starts_at }
        }, client);
        await client.query("COMMIT");

        if (!desk) {
            notify({ roles: ["chairman", "committee"], title: `Booking request: ${booking.title}`, message: `${req.user.full_name} · ${booking.resource_name}`, type: "booking" });
            chairmanEmails().then((to) => to.length && sendEmail({ to, ...emails.bookingRequested(booking) }));
        }
        res.status(201).json({
            success: true,
            booking: await findBooking(booking.id),
            message: desk ? `Booked: ${booking.title}` : "Request sent. You'll get a message once it's decided."
        });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
};

// PATCH /api/bookings/:id/approve  { create_tasks?: true }   – any committee member can decide (AC2)
export const approveBooking = async (req, res) => {
    const id = parseId(req.params.id);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const booking = id && await findBooking(id, client);
        if (!booking) { await client.query("ROLLBACK"); return fail(res, 404, "Booking not found"); }
        if (booking.status !== "pending") { await client.query("ROLLBACK"); return fail(res, 409, "This request has already been decided"); }

        await client.query("SELECT pg_advisory_xact_lock(42, $1)", [booking.resource_id]);
        const clashes = await findClashes(booking.resource_id, booking.starts_at, booking.ends_at, booking.id, client);
        if (clashes.length) {
            await client.query("ROLLBACK");
            return fail(res, 409, `Can't approve: ${booking.resource_name} is already booked then ("${clashes[0].title}")`);
        }

        await client.query(
            "UPDATE bookings SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
            [req.user.id, booking.id]
        );
        const approved = await findBooking(booking.id, client);
        const tasks = req.body?.create_tasks === false ? [] : await createPrepTasks(approved, req.user, client);
        await logAudit({
            actorId: req.user.id, action: "booking.approved", entityType: "booking", entityId: booking.id,
            details: { title: booking.title, tasks: tasks.length }
        }, client);
        await client.query("COMMIT");

        if (approved.requested_by && approved.requested_by !== req.user.id) {
            notify({ userId: approved.requested_by, title: `Booking confirmed: ${approved.title}`, message: `${approved.resource_name} · approved by ${req.user.full_name}`, type: "booking" });
        }
        if (approved.contact_email) sendEmail({ to: approved.contact_email, ...emails.bookingApproved(approved) });

        res.json({
            success: true,
            booking: await findBooking(booking.id),
            message: tasks.length ? `Approved · ${tasks.length} prep task${tasks.length > 1 ? "s" : ""} added` : "Approved"
        });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
};

// PATCH /api/bookings/:id/decline  { reason }
export const declineBooking = async (req, res) => {
    const id = parseId(req.params.id);
    const reason = text(req.body?.reason, 500);
    if (!reason) return fail(res, 400, "Please give a reason (it's sent to them)");
    const booking = id && await findBooking(id);
    if (!booking) return fail(res, 404, "Booking not found");
    if (booking.status !== "pending") return fail(res, 409, "This request has already been decided");

    await pool.query(
        "UPDATE bookings SET status = 'declined', reviewed_by = $1, reviewed_at = NOW(), decision_note = $2 WHERE id = $3",
        [req.user.id, reason, booking.id]
    );
    await logAudit({ actorId: req.user.id, action: "booking.declined", entityType: "booking", entityId: booking.id, details: { title: booking.title, reason } });
    if (booking.requested_by) {
        notify({ userId: booking.requested_by, title: `Booking not approved: ${booking.title}`, message: reason, type: "booking" });
    }
    if (booking.contact_email) sendEmail({ to: booking.contact_email, ...emails.bookingDeclined(booking, reason) });
    res.json({ success: true, booking: await findBooking(booking.id), message: "Declined. They've been told why." });
};

// PATCH /api/bookings/:id/cancel  { reason? }   – the requester (their own) or an admin
// Cancels the booking's prep tasks that haven't been done yet.
export const cancelBooking = async (req, res) => {
    const id = parseId(req.params.id);
    const booking = id && await findBooking(id);
    if (!booking || (!isAdmin(req.user) && booking.requested_by !== req.user.id)) return fail(res, 404, "Booking not found");
    if (!["pending", "approved"].includes(booking.status)) return fail(res, 409, "This booking is already closed");

    const reason = text(req.body?.reason, 500);
    await pool.query(
        "UPDATE bookings SET status = 'cancelled', decision_note = COALESCE($1, decision_note) WHERE id = $2",
        [reason, booking.id]
    );
    const cancelled = await pool.query(
        "UPDATE tasks SET status = 'cancelled' WHERE booking_id = $1 AND status = 'todo' RETURNING id", [booking.id]
    );
    await logAudit({ actorId: req.user.id, action: "booking.cancelled", entityType: "booking", entityId: booking.id, details: { title: booking.title, reason, tasks_cancelled: cancelled.rowCount } });
    if (booking.requested_by && booking.requested_by !== req.user.id) {
        notify({ userId: booking.requested_by, title: `Booking cancelled: ${booking.title}`, message: reason ?? `Cancelled by ${req.user.full_name}`, type: "booking" });
    }
    res.json({ success: true, booking: await findBooking(booking.id), message: cancelled.rowCount ? `Cancelled, with ${cancelled.rowCount} prep task${cancelled.rowCount > 1 ? "s" : ""}` : "Cancelled" });
};

// POST /api/bookings/:id/ask  { question }   – "Ask a question" (AC2): goes to the requester; the request stays waiting
export const askAboutBooking = async (req, res) => {
    const id = parseId(req.params.id);
    const question = text(req.body?.question, 500);
    if (!question) return fail(res, 400, "Write your question");
    const booking = id && await findBooking(id);
    if (!booking) return fail(res, 404, "Booking not found");
    if (!booking.requested_by) return fail(res, 400, "This booking has no requester in the app to ask");

    await notify({ userId: booking.requested_by, title: `Question about "${booking.title}"`, message: `${req.user.full_name}: ${question}`, type: "booking" });
    await logAudit({ actorId: req.user.id, action: "booking.question", entityType: "booking", entityId: booking.id, details: { title: booking.title, question } });
    res.json({ success: true, message: `Sent to ${booking.requested_by_name}` });
};
