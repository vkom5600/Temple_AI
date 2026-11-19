import cron from "node-cron";
import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { getSetting } from "../services/settingsService.js";
import { TASK_SELECT, TIMEZONE, notifyAssignees } from "../services/taskService.js";

// Every hour: a gentle reminder to the people on each overdue task, the same
// as pressing Remind (their phone shows "Reminder" on the task card).
//  - only between 07:00 and 21:00 temple time, never at night
//  - at most once every 3 hours per task, and at most 3 automatic reminders
//  - the chairman can switch it off in Settings ("auto_reminders")
// The Action Center already shows overdue work to the committee, so they aren't pinged.

const GAP_HOURS = 3;
const MAX_AUTO = 3;
const DAY_START = 7;
const DAY_END = 21;

const templeHour = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date()));

export const runOverdueReminderJob = async ({ force = false } = {}) => {
    if (!force) {
        if (!(await getSetting("auto_reminders", true))) return { skipped: "switched off" };
        const hour = templeHour();
        if (hour < DAY_START || hour >= DAY_END) return { skipped: "outside temple hours" };
    }

    // Only one server instance sends reminders at a time
    const client = await pool.connect();
    try {
        const lock = await client.query("SELECT pg_try_advisory_lock(42, 0) AS ok");
        if (!lock.rows[0].ok) return { skipped: "already running" };

        const due = await client.query(
            `${TASK_SELECT}
             WHERE t.status = 'todo' AND t.due_at < NOW()
               AND t.auto_reminder_count < $1
               AND (t.last_reminded_at IS NULL OR t.last_reminded_at < NOW() - make_interval(hours => $2))
             ORDER BY t.due_at
             LIMIT 100`,
            [MAX_AUTO, GAP_HOURS]
        );

        let people = 0;
        for (const task of due.rows) {
            await client.query(
                `UPDATE tasks SET last_reminded_at = NOW(), reminder_count = reminder_count + 1,
                                  auto_reminder_count = auto_reminder_count + 1, last_reminded_by = NULL
                 WHERE id = $1`,
                [task.id]
            );
            const sent = await notifyAssignees(task, {
                title: `Reminder: ${task.title}`,
                message: "This task is overdue. Please do it when you can, or tap \"I need help\" if something's stopping you."
            });
            people += sent.length;
            await logAudit({ actorId: null, action: "task.auto_reminded", entityType: "task", entityId: task.id, details: { recipients: sent.length } }, client);
        }
        if (due.rowCount) console.log(`Overdue reminders: ${due.rowCount} task(s), ${people} people reminded.`);
        return { tasks: due.rowCount, people };
    } finally {
        await client.query("SELECT pg_advisory_unlock(42, 0)").catch(() => {});
        client.release();
    }
};

export const startOverdueReminderJob = () => {
    cron.schedule("0 * * * *", () => runOverdueReminderJob().catch((error) => console.error("Overdue reminder job failed:", error.message)), { timezone: TIMEZONE });
};
