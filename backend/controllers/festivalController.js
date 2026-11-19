import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { templeDate } from "../services/reportService.js";
import { TIMEZONE } from "../services/taskService.js";

// H2 festival days: the list, and what Home shows (today, coming up, the planning reminder).

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SELECT = `SELECT id, name, subtitle, TO_CHAR(festival_date, 'YYYY-MM-DD') AS date, kind,
                       TO_CHAR(opens, 'HH24:MI') AS opens, TO_CHAR(closes, 'HH24:MI') AS closes,
                       confirmed, remind, TO_CHAR(snoozed_until, 'YYYY-MM-DD') AS snoozed_until
                FROM festivals`;
const REMIND_DAYS = 42; // "Diwali is in 6 weeks"

const validate = (b = {}) => {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
    if (!name) return { error: "Give the festival a name" };
    if (!DATE.test(b.date ?? "")) return { error: "Choose the day" };
    for (const t of [b.opens, b.closes]) if (t && !TIME.test(t)) return { error: "Times must be HH:MM" };
    if (b.opens && b.closes && b.closes <= b.opens) return { error: "Closing must be after opening" };
    return {
        data: {
            name, date: b.date,
            subtitle: typeof b.subtitle === "string" && b.subtitle.trim() ? b.subtitle.trim().slice(0, 160) : null,
            kind: b.kind === "observance" ? "observance" : "festival",
            opens: b.opens || null, closes: b.closes || null,
            confirmed: b.confirmed !== false, remind: b.remind !== false,
        },
    };
};

// GET /api/festivals?from=&to=   everyone signed in (staff see them on their phone too)
export const list = async (req, res) => {
    const from = DATE.test(req.query.from ?? "") ? req.query.from : templeDate(-31);
    const to = DATE.test(req.query.to ?? "") ? req.query.to : templeDate(400);
    const rows = await pool.query(`${SELECT} WHERE festival_date BETWEEN $1 AND $2 ORDER BY festival_date, name`, [from, to]);
    res.json({ success: true, festivals: rows.rows });
};

// GET /api/festivals/home   Home banner, "Coming up", and the planning reminder
export const home = async (req, res) => {
    const today = templeDate();
    const todays = (await pool.query(`${SELECT} WHERE festival_date = $1 ORDER BY kind, name`, [today])).rows;
    const next = (await pool.query(`${SELECT} WHERE festival_date > $1 ORDER BY festival_date LIMIT 1`, [today])).rows[0] ?? null;

    // Planning reminder: the next festival within 6 weeks that isn't planned or snoozed
    let reminder = null;
    const soon = (await pool.query(
        `${SELECT} WHERE kind = 'festival' AND remind AND festival_date > $1 AND festival_date <= $1::date + $2::int
           AND (snoozed_until IS NULL OR snoozed_until < $1::date)
         ORDER BY festival_date`, [today, REMIND_DAYS])).rows;
    for (const f of soon) {
        const word = f.name.split(/\s+/)[0];
        const planned = await pool.query(
            `SELECT 1 FROM bookings WHERE kind = 'event' AND status = 'approved' AND title ILIKE $1
               AND (starts_at AT TIME ZONE $3)::date BETWEEN $2::date - 2 AND $2::date + 2 LIMIT 1`, [`%${word}%`, f.date, TIMEZONE]);
        if (planned.rowCount) continue;
        const last = (await pool.query(
            `SELECT b.id, b.title, COUNT(t.id)::int AS tasks,
                    COUNT(DISTINCT t.completed_by) FILTER (WHERE u.role = 'volunteer')::int AS volunteers
             FROM bookings b LEFT JOIN tasks t ON t.booking_id = b.id AND t.status <> 'cancelled'
             LEFT JOIN users u ON u.id = t.completed_by
             WHERE b.status = 'approved' AND b.starts_at < NOW() AND b.title ILIKE $1
             GROUP BY b.id ORDER BY b.starts_at DESC LIMIT 1`, [`%${word}%`])).rows[0] ?? null;
        const days = Math.round((new Date(`${f.date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000);
        reminder = { festival: f, days, last_time: last && last.tasks ? last : null };
        break;
    }

    // Temple events booked today (festival programme)
    const events = (await pool.query(
        `SELECT COUNT(*)::int AS n FROM bookings WHERE kind = 'event' AND status = 'approved' AND (starts_at AT TIME ZONE $2)::date = $1::date`, [today, TIMEZONE])).rows[0].n;
    res.json({ success: true, today: todays, next, reminder, events_today: events });
};

// POST /api/festivals   (chairman, committee)
export const create = async (req, res) => {
    const { data, error } = validate(req.body);
    if (error) return fail(res, 400, error);
    const row = await pool.query(
        `INSERT INTO festivals (name, subtitle, festival_date, kind, opens, closes, confirmed, remind, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [data.name, data.subtitle, data.date, data.kind, data.opens, data.closes, data.confirmed, data.remind, req.user.id]);
    await logAudit({ actorId: req.user.id, action: "festival.created", entityType: "festival", entityId: row.rows[0].id, details: { name: data.name, date: data.date } });
    res.status(201).json({ success: true, message: `${data.name} added`, festival: (await pool.query(`${SELECT} WHERE id = $1`, [row.rows[0].id])).rows[0] });
};

// PUT /api/festivals/:id
export const update = async (req, res) => {
    const id = Number(req.params.id);
    const { data, error } = validate(req.body);
    if (error) return fail(res, 400, error);
    const r = await pool.query(
        `UPDATE festivals SET name=$1, subtitle=$2, festival_date=$3, kind=$4, opens=$5, closes=$6, confirmed=$7, remind=$8 WHERE id=$9`,
        [data.name, data.subtitle, data.date, data.kind, data.opens, data.closes, data.confirmed, data.remind, id]);
    if (!r.rowCount) return fail(res, 404, "Festival not found");
    await logAudit({ actorId: req.user.id, action: "festival.updated", entityType: "festival", entityId: id, details: { name: data.name, date: data.date } });
    res.json({ success: true, message: "Saved" });
};

// DELETE /api/festivals/:id
export const remove = async (req, res) => {
    const id = Number(req.params.id);
    const r = await pool.query("DELETE FROM festivals WHERE id = $1 RETURNING name", [id]);
    if (!r.rowCount) return fail(res, 404, "Festival not found");
    await logAudit({ actorId: req.user.id, action: "festival.deleted", entityType: "festival", entityId: id, details: { name: r.rows[0].name } });
    res.json({ success: true, message: `${r.rows[0].name} removed` });
};

// POST /api/festivals/:id/snooze  { for: 'week' | 'year' }   ("Later" / "Not this year")
export const snooze = async (req, res) => {
    const id = Number(req.params.id);
    const f = (await pool.query(`${SELECT} WHERE id = $1`, [id])).rows[0];
    if (!f) return fail(res, 404, "Festival not found");
    const until = req.body?.for === "year" ? f.date : templeDate(7);
    await pool.query("UPDATE festivals SET snoozed_until = $1 WHERE id = $2", [until, id]);
    res.json({ success: true, message: req.body?.for === "year" ? `No reminder for ${f.name} this year` : "We'll remind you next week" });
};
