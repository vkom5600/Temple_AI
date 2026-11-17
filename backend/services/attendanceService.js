import pool from "../config/db.js";
import { logAudit } from "./auditService.js";
import { notify } from "./notificationService.js";
import { sendEmail, chairmanEmails } from "./emailService.js";
import { getSetting, setSetting } from "./settingsService.js";
import { TIMEZONE } from "./taskService.js";
import * as emails from "./emailTemplates.js";

// "Today" in the temple's time zone, as SQL. Use with TIMEZONE as the parameter.
export const todaySql = (n) => `(NOW() AT TIME ZONE $${n})::date`;

export const CLOSING_ITEMS = {
    lamps: "Lamps off",
    gas: "Gas off",
    doors: "Doors locked"
};

export const findRecord = async (userId, dateSql, params, db = pool) => {
    const result = await db.query(
        `SELECT * FROM attendance WHERE user_id = $1 AND attendance_date = ${dateSql}`,
        [userId, ...params]
    );
    return result.rows[0] ?? null;
};

export const myToday = (userId, db = pool) => findRecord(userId, todaySql(2), [TIMEZONE], db);

// Is anyone else still on site today?
export const othersHere = async (userId, db = pool) => {
    const result = await db.query(
        `SELECT COUNT(*)::int AS n FROM attendance
         WHERE attendance_date = ${todaySql(2)}
           AND status = 'present' AND check_in IS NOT NULL AND check_out IS NULL
           AND user_id <> $1`,
        [userId, TIMEZONE]
    );
    return result.rows[0].n;
};

// Evening check: once a day, after the chairman's closing time, tell the
// chairman if anyone is still checked in or nobody confirmed the closing
// checks. Days when nobody checked in at all are skipped (temple closed).
export const runClosingCheck = async () => {
    const closingTime = await getSetting("closing_time", "21:00");

    const now = (await pool.query(
        `SELECT to_char(NOW() AT TIME ZONE $1, 'YYYY-MM-DD') AS today,
                to_char(NOW() AT TIME ZONE $1, 'HH24:MI') AS time`,
        [TIMEZONE]
    )).rows[0];

    if (now.time < closingTime) return null;
    if ((await getSetting("closing_check_last_date")) === now.today) return null;

    // Mark as done first, so two runs can never both send.
    await setSetting("closing_check_last_date", now.today, null);

    const result = await pool.query(
        `SELECT u.full_name, a.check_in, a.check_out, a.closing_confirmed_at
         FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE a.attendance_date = $1::date AND a.status = 'present' AND a.check_in IS NOT NULL`,
        [now.today]
    );

    if (result.rowCount === 0) return { today: now.today, skipped: "nobody came in" };

    const stillIn = result.rows.filter((r) => !r.check_out).map((r) => r.full_name);
    const confirmed = result.rows.some((r) => r.closing_confirmed_at);

    if (!stillIn.length && confirmed) return { today: now.today, ok: true };

    const problems = [
        stillIn.length && `Still checked in: ${stillIn.join(", ")}.`,
        !confirmed && "Nobody confirmed lamps, gas and doors today."
    ].filter(Boolean);

    await notify({
        roles: ["chairman"],
        title: "Closing check: please confirm the temple is shut",
        message: problems.join(" "),
        type: "attendance"
    });
    await sendEmail({ to: await chairmanEmails(), ...emails.closingAlert(problems, closingTime) });

    await logAudit({
        actorId: null,
        action: "attendance.closing_alert",
        entityType: "attendance",
        details: { date: now.today, still_in: stillIn, confirmed }
    });

    return { today: now.today, stillIn, confirmed };
};
