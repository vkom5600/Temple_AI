import pool from "../config/db.js";
import { TIMEZONE } from "./taskService.js";
import { aiEnabled, aiModel, askText } from "./aiService.js";

// R1 nightly report (Phase 4): the facts for one temple day, a short written
// summary (Temple AI when connected, otherwise the built-in wording), stored in
// daily_reports. The Reports page and the chairman's notification read it.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const templeDate = (offsetDays = 0) => {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
};

const dayLabel = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

// Everything that happened on one temple day, as plain numbers and names.
export const buildDayFacts = async (date) => {
    if (!DATE.test(date)) throw new Error("Date must be YYYY-MM-DD");
    const tz = TIMEZONE;
    const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
    const all = async (sql, params) => (await pool.query(sql, params)).rows;

    const tasks = await one(
        `SELECT COUNT(*)::int AS due,
                COUNT(*) FILTER (WHERE status IN ('done', 'awaiting_signoff'))::int AS finished,
                COUNT(*) FILTER (WHERE completed_at > due_at)::int AS late,
                COUNT(*) FILTER (WHERE status = 'todo')::int AS not_done,
                COUNT(*) FILTER (WHERE status = 'flagged')::int AS couldnt_do,
                COUNT(*) FILTER (WHERE status = 'awaiting_signoff')::int AS waiting_signoff
         FROM tasks
         WHERE status <> 'cancelled' AND (due_at AT TIME ZONE $2)::date = $1::date`, [date, tz]);
    const lateOnes = await all(
        `SELECT t.title, COALESCE(u.full_name, INITCAP(t.assigned_group)) AS who
         FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.status <> 'cancelled' AND (t.due_at AT TIME ZONE $2)::date = $1::date
           AND (t.completed_at > t.due_at OR t.status = 'todo')
         ORDER BY t.due_at LIMIT 5`, [date, tz]);

    const people = await all(
        `SELECT u.full_name, COALESCE(a.status, 'none') AS status, a.check_in
         FROM users u
         LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = $1::date
         WHERE u.is_active AND u.removed_at IS NULL AND u.approval_status = 'approved' AND u.role IN ('staff', 'volunteer')`, [date]);
    const came = people.filter((p) => p.check_in);
    const absent = people.filter((p) => p.status === "absent");
    const missing = people.filter((p) => !p.check_in && p.status !== "absent");

    const issues = await one(
        `SELECT COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $2)::date = $1::date)::int AS reported,
                COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $2)::date = $1::date AND status <> 'open')::int AS sorted,
                COUNT(*) FILTER (WHERE status = 'open')::int AS still_open
         FROM issues`, [date, tz]);
    const openIssues = await all(`SELECT description FROM issues WHERE status = 'open' ORDER BY created_at DESC LIMIT 3`);

    const bookings = await all(
        `SELECT b.title, b.kind, b.guests, r.name AS space
         FROM bookings b JOIN resources r ON r.id = b.resource_id
         WHERE b.status = 'approved' AND (b.starts_at AT TIME ZONE $2)::date = $1::date
         ORDER BY b.starts_at`, [date, tz]);
    const pending = await one(`SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'pending' AND starts_at > NOW()`);

    return {
        date,
        day: dayLabel(date),
        tasks: { ...tasks, late_or_not_done: lateOnes.map((t) => `${t.title} (${t.who})`) },
        attendance: { expected: people.length - absent.length, came: came.length, absent: absent.map((p) => p.full_name), did_not_come: missing.map((p) => p.full_name) },
        problems: { ...issues, open: openIssues.map((i) => i.description) },
        bookings: { held: bookings.map((b) => `${b.title} (${b.space}${b.guests ? `, ${b.guests} people` : ""})`), requests_waiting: pending.n },
    };
};

const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// The built-in wording, used without Temple AI (or if a call fails).
export const rulesSummary = (f) => {
    const parts = [];
    const t = f.tasks;
    if (t.due) {
        const p = pct(t.finished, t.due);
        parts.push(`${p >= 90 ? "A steady day" : p >= 70 ? "A mostly good day" : "A busy day"}: ${t.finished} of ${t.due} tasks were finished (${p}%).`);
        if (t.late_or_not_done.length) parts.push(`Late or not done: ${t.late_or_not_done.slice(0, 3).join(", ")}.`);
        if (t.waiting_signoff) parts.push(`${t.waiting_signoff} safety task${t.waiting_signoff === 1 ? " is" : "s are"} waiting for a second check.`);
    } else {
        parts.push("No tasks were due.");
    }
    const a = f.attendance;
    if (a.expected) parts.push(`${a.came} of ${a.expected} staff and volunteers came in${a.did_not_come.length ? ` (not in: ${a.did_not_come.slice(0, 4).join(", ")})` : ""}.`);
    if (f.bookings.held.length) parts.push(`Held at the temple: ${f.bookings.held.slice(0, 3).join("; ")}.`);
    const pr = f.problems;
    if (pr.reported) parts.push(`${pr.reported} problem${pr.reported === 1 ? " was" : "s were"} reported and ${pr.sorted} sorted.`);
    if (pr.still_open) parts.push(`${pr.still_open} problem${pr.still_open === 1 ? " is" : "s are"} still open${pr.open[0] ? `, including "${pr.open[0]}"` : ""}.`);
    if (f.bookings.requests_waiting) parts.push(`${f.bookings.requests_waiting} booking request${f.bookings.requests_waiting === 1 ? " is" : "s are"} waiting for a decision.`);
    return parts.join(" ");
};

const SUMMARY_SYSTEM = `You write the short report for a Hindu temple's chairman, from the facts given. Write 3 to 5 plain sentences: how the period went, what ran late or was missed (with names), anything that needs the chairman's attention, and one practical suggestion if the facts support it. Use only the facts given; never invent numbers, names or events. No headings, no bullet points, no greeting. British English.`;

// A summary for any facts: Temple AI when connected, else the built-in wording.
export const writeSummary = async (facts, { label } = {}) => {
    if (aiEnabled()) {
        const r = await askText({
            system: SUMMARY_SYSTEM,
            messages: [{ role: "user", content: `${label ?? facts.day ?? "Report"}\n\nFACTS:\n${JSON.stringify(facts)}` }],
            maxTokens: 800,
        });
        if (r.ok && r.text) return { summary: r.text, written_by: "ai" };
    }
    return { summary: facts.tasks ? rulesSummary(facts) : null, written_by: "rules" };
};

export const generateDailyReport = async (date) => {
    const facts = await buildDayFacts(date);
    const { summary, written_by } = await writeSummary(facts);
    const row = await pool.query(
        `INSERT INTO daily_reports (report_date, facts, summary, written_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_date) DO UPDATE SET facts = EXCLUDED.facts, summary = EXCLUDED.summary,
                                                written_by = EXCLUDED.written_by, created_at = NOW()
         RETURNING report_date, facts, summary, written_by, created_at`,
        [date, JSON.stringify(facts), summary, written_by]
    );
    return row.rows[0];
};

export const findDailyReport = async (date) =>
    (await pool.query(`SELECT TO_CHAR(report_date, 'YYYY-MM-DD') AS report_date, facts, summary, written_by, created_at FROM daily_reports WHERE report_date = $1`, [date])).rows[0] ?? null;

export const writerLabel = (r) => (r.written_by === "ai" ? `Temple AI (${aiModel()})` : "the records");
