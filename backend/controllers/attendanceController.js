import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { sendEmail, chairmanEmails } from "../services/emailService.js";
import * as emails from "../services/emailTemplates.js";
import { TIMEZONE } from "../services/taskService.js";
import { CLOSING_ITEMS, myToday, othersHere, todaySql } from "../services/attendanceService.js";
import { parseId } from "../utils/userValidation.js";

const UNDO_MINUTES = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const fail = (res, status, message) =>
    res.status(status).json({ success: false, message });

// What the check-in card needs: today's record, am I the last one here, and my last 30 days.
const myState = async (userId) => {
    const today = await myToday(userId);
    const onSite = today?.status === "present" && today.check_in && !today.check_out;
    const history = await pool.query(
        `SELECT attendance_date, status, check_in, check_out
         FROM attendance
         WHERE user_id = $1 AND attendance_date > ${todaySql(2)} - 30
         ORDER BY attendance_date DESC`,
        [userId, TIMEZONE]
    );

    return {
        today,
        on_site: Boolean(onSite),
        last_one_here: onSite ? (await othersHere(userId)) === 0 : false,
        can_undo: Boolean(onSite && Date.now() - new Date(today.check_in).getTime() < UNDO_MINUTES * 60_000),
        closing_items: CLOSING_ITEMS,
        history: history.rows
    };
};

const respond = async (res, userId, message, status = 200) =>
    res.status(status).json({ success: true, message, ...(await myState(userId)) });

// ---------------------------------------------------------------- my attendance

// GET /api/attendance/me
export const getMine = async (req, res) => {
    res.json({ success: true, ...(await myState(req.user.id)) });
};

// POST /api/attendance/check-in  – "I'm here"
export const checkIn = async (req, res) => {
    const today = await myToday(req.user.id);

    if (today?.status === "present" && today.check_in) {
        return fail(res, 409, today.check_out ? "You've left today. Tap \"I'm back\" instead." : "You're already checked in");
    }

    if (today) {
        // Marked absent (or added without a time) but here after all.
        await pool.query(
            `UPDATE attendance
             SET status = 'present', check_in = NOW(), check_out = NULL, updated_by = $1
             WHERE id = $2`,
            [req.user.id, today.id]
        );
    } else {
        await pool.query(
            `INSERT INTO attendance (user_id, attendance_date, status, check_in, updated_by)
             VALUES ($1, ${todaySql(2)}, 'present', NOW(), $1)`,
            [req.user.id, TIMEZONE]
        );
    }

    await logAudit({ actorId: req.user.id, action: "attendance.checked_in", entityType: "attendance", entityId: req.user.id });
    await respond(res, req.user.id, "Thank you. You're checked in.", 201);
};

// POST /api/attendance/undo-check-in  – within 10 minutes, if tapped by mistake
export const undoCheckIn = async (req, res) => {
    const result = await pool.query(
        `DELETE FROM attendance
         WHERE user_id = $1 AND attendance_date = ${todaySql(2)}
           AND status = 'present' AND check_out IS NULL
           AND check_in > NOW() - make_interval(mins => $3)
         RETURNING id`,
        [req.user.id, TIMEZONE, UNDO_MINUTES]
    );

    if (result.rowCount === 0) {
        return fail(res, 400, `Check-in can only be undone within ${UNDO_MINUTES} minutes`);
    }

    await logAudit({ actorId: req.user.id, action: "attendance.check_in_undone", entityType: "attendance", entityId: req.user.id });
    await respond(res, req.user.id, "Check-in undone");
};

// POST /api/attendance/leave  body: { closing?: { lamps, gas, doors } }
// The last person on site confirms the closing checks. Anything not ticked
// counts as skipped and the chairman is told.
export const leave = async (req, res) => {
    const today = await myToday(req.user.id);

    if (!(today?.status === "present" && today.check_in && !today.check_out)) {
        return fail(res, 400, "You're not checked in right now");
    }

    const isLast = (await othersHere(req.user.id)) === 0;
    let closing = null;
    let missing = [];

    if (isLast) {
        const ticked = req.body?.closing ?? {};
        closing = Object.fromEntries(Object.keys(CLOSING_ITEMS).map((key) => [key, ticked[key] === true]));
        missing = Object.keys(CLOSING_ITEMS).filter((key) => !closing[key]).map((key) => CLOSING_ITEMS[key]);
    }

    await pool.query(
        `UPDATE attendance
         SET check_out = NOW(), updated_by = $1,
             closing_checks = $2,
             closing_confirmed_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
             closing_skipped = $4
         WHERE id = $5`,
        [req.user.id, closing ? JSON.stringify(closing) : null, isLast && !missing.length, isLast && missing.length > 0, today.id]
    );

    await logAudit({
        actorId: req.user.id,
        action: "attendance.checked_out",
        entityType: "attendance",
        entityId: req.user.id,
        details: isLast ? { last_out: true, closing, missing } : {}
    });

    if (isLast && missing.length) {
        await notify({
            roles: ["chairman"],
            excludeUserId: req.user.id,
            title: "Closing checks skipped",
            message: `${req.user.full_name} left last without confirming: ${missing.join(", ")}.`,
            type: "attendance"
        });
        if (req.user.role !== "chairman") {
            await sendEmail({ to: await chairmanEmails(), ...emails.closingSkipped(req.user, missing) });
        }
    }

    const message = !isLast
        ? "See you next time"
        : missing.length
            ? "Noted. The chairman has been told the closing checks weren't all done."
            : "Thank you for locking up. See you next time.";

    await respond(res, req.user.id, message);
};

// POST /api/attendance/back  – "I'm back" after leaving
export const back = async (req, res) => {
    const today = await myToday(req.user.id);

    if (!(today?.status === "present" && today.check_out)) {
        return fail(res, 400, "You haven't left today");
    }

    await pool.query(
        `UPDATE attendance
         SET check_out = NULL, closing_checks = NULL, closing_confirmed_at = NULL,
             closing_skipped = FALSE, updated_by = $1
         WHERE id = $2`,
        [req.user.id, today.id]
    );

    await logAudit({ actorId: req.user.id, action: "attendance.returned", entityType: "attendance", entityId: req.user.id });
    await respond(res, req.user.id, "Welcome back");
};

// ---------------------------------------------------------------- admins

// GET /api/attendance?date=YYYY-MM-DD  (admins) – Who's On
// Everyone expected (staff + volunteers) plus anyone else with a record that day.
export const getDay = async (req, res) => {
    const date = req.query.date;
    if (date && !DATE_PATTERN.test(date)) return fail(res, 400, "date must be YYYY-MM-DD");

    const dateSql = date ? "$1::date" : todaySql(1);
    const params = [date ?? TIMEZONE];

    const day = (await pool.query(`SELECT to_char(${dateSql}, 'YYYY-MM-DD') AS d`, params)).rows[0].d;

    const people = await pool.query(
        `SELECT u.id AS user_id, u.full_name, u.role, sp.designation,
                a.id, a.status, a.check_in, a.check_out, a.notes,
                a.closing_confirmed_at, a.closing_skipped, a.closing_checks,
                editor.full_name AS updated_by_name, a.updated_by, a.updated_at,
                CASE
                    WHEN a.status = 'absent' THEN 'absent'
                    WHEN a.check_in IS NULL THEN 'not_in'
                    WHEN a.check_out IS NULL THEN 'here'
                    ELSE 'left'
                END AS state
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = $1::date
         LEFT JOIN users editor ON editor.id = a.updated_by
         WHERE u.approval_status = 'approved'
           AND ((u.is_active AND u.role IN ('staff', 'volunteer')) OR a.id IS NOT NULL)
         ORDER BY CASE u.role WHEN 'staff' THEN 1 WHEN 'volunteer' THEN 2 ELSE 3 END, u.full_name`,
        [day]
    );

    const rows = people.rows;
    const present = rows.filter((r) => ["here", "left"].includes(r.state));

    // Jobs that have staff but nobody came in.
    const jobs = [...new Set(rows.filter((r) => r.designation).map((r) => r.designation))];
    const gaps = jobs.filter((job) => !present.some((r) => r.designation === job));
    if (rows.some((r) => r.role === "volunteer") && !present.some((r) => r.role === "volunteer")) gaps.push("volunteer");

    const closer = rows
        .filter((r) => r.closing_confirmed_at || r.closing_skipped)
        .sort((a, b) => new Date(b.check_out) - new Date(a.check_out))[0];

    res.json({
        success: true,
        date: day,
        people: rows,
        counts: {
            here: rows.filter((r) => r.state === "here").length,
            left: rows.filter((r) => r.state === "left").length,
            not_in: rows.filter((r) => r.state === "not_in").length,
            absent: rows.filter((r) => r.state === "absent").length
        },
        gaps,
        closing: closer
            ? {
                by: closer.full_name,
                at: closer.closing_confirmed_at ?? closer.check_out,
                confirmed: Boolean(closer.closing_confirmed_at),
                checks: closer.closing_checks
            }
            : null
    });
};

// PUT /api/attendance/:userId/:date  (admins)  body: { status, check_in?, check_out?, notes? }
// Mark absent, add a forgotten check-in, or correct any record.
export const upsertRecord = async (req, res) => {
    const userId = parseId(req.params.userId);
    const { date } = req.params;
    const body = req.body ?? {};

    if (!userId || !DATE_PATTERN.test(date)) return fail(res, 400, "Give a person and a date (YYYY-MM-DD)");
    if (!["present", "absent"].includes(body.status)) return fail(res, 400, "Status must be present or absent");

    const person = await pool.query(
        "SELECT id, full_name FROM users WHERE id = $1 AND approval_status = 'approved'",
        [userId]
    );
    if (!person.rowCount) return fail(res, 404, "Person not found");

    const time = (value) => (value ? new Date(value) : null);
    const checkIn = body.status === "present" ? time(body.check_in) : null;
    const checkOut = body.status === "present" ? time(body.check_out) : null;

    if ([checkIn, checkOut].some((t) => t && Number.isNaN(t.getTime()))) return fail(res, 400, "Times must be valid");
    if (body.status === "present" && !checkIn) return fail(res, 400, "Give the time they came in");
    if (checkIn && checkOut && checkOut < checkIn) return fail(res, 400, "They can't leave before they arrive");

    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

    const before = (await pool.query(
        "SELECT status, check_in, check_out, notes FROM attendance WHERE user_id = $1 AND attendance_date = $2",
        [userId, date]
    )).rows[0] ?? null;

    await pool.query(
        `INSERT INTO attendance (user_id, attendance_date, status, check_in, check_out, notes, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, attendance_date) DO UPDATE
         SET status = EXCLUDED.status, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
             notes = EXCLUDED.notes, updated_by = EXCLUDED.updated_by`,
        [userId, date, body.status, checkIn, checkOut, notes, req.user.id]
    );

    const markedAbsent = body.status === "absent" && before?.status !== "absent";

    await logAudit({
        actorId: req.user.id,
        action: markedAbsent ? "attendance.marked_absent" : before ? "attendance.corrected" : "attendance.added",
        entityType: "attendance",
        entityId: userId,
        details: {
            date,
            before,
            after: { status: body.status, check_in: checkIn, check_out: checkOut, notes }
        }
    });

    await notify({
        userId,
        excludeUserId: req.user.id,
        title: markedAbsent ? `Marked absent for ${date}` : `Attendance updated for ${date}`,
        message: `${req.user.full_name} ${markedAbsent ? "marked you absent" : "updated your attendance record"}${notes ? `: ${notes}` : "."}`,
        type: "attendance"
    });

    res.json({
        success: true,
        message: markedAbsent ? `${person.rows[0].full_name} marked absent` : "Attendance saved"
    });
};

// DELETE /api/attendance/:userId/:date  (admins) – remove a wrong record
export const deleteRecord = async (req, res) => {
    const userId = parseId(req.params.userId);
    const { date } = req.params;
    if (!userId || !DATE_PATTERN.test(date)) return fail(res, 400, "Give a person and a date (YYYY-MM-DD)");

    const result = await pool.query(
        "DELETE FROM attendance WHERE user_id = $1 AND attendance_date = $2 RETURNING status, check_in, check_out",
        [userId, date]
    );
    if (!result.rowCount) return fail(res, 404, "No record for that day");

    await logAudit({
        actorId: req.user.id,
        action: "attendance.removed",
        entityType: "attendance",
        entityId: userId,
        details: { date, removed: result.rows[0] }
    });

    res.json({ success: true, message: "Record removed" });
};
