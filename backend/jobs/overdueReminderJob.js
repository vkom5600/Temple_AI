
import cron from "node-cron";
import pool from "../config/db.js";

// Process overdue tasks and create notifications
export const runOverdueReminderJob = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Select overdue tasks that have not been reminded
    // within the previous 24 hours.
    const tasks = await client.query(`
      SELECT
        t.id,
        t.title,
        t.status,
        t.assigned_to,
        t.due_at
      FROM tasks t
      WHERE t.due_at < NOW()
        AND t.status IN (
          'assigned',
          'completed',
          'pending_verification'
        )
        AND (
          t.last_overdue_reminder_at IS NULL
          OR t.last_overdue_reminder_at
             <= NOW() - INTERVAL '24 hours'
        )
      ORDER BY t.due_at ASC
      LIMIT 100
      FOR UPDATE OF t SKIP LOCKED
    `);

    let notificationCount = 0;

    for (const task of tasks.rows) {
      const recipients = await client.query(
        `
        SELECT id
        FROM users
        WHERE is_active = TRUE
          AND (
            id = $1
            OR role IN ('chairman', 'committee')
          )
        `,
        [task.assigned_to]
      );

      const title = "Overdue Task Reminder";

      const message =
        `Task "${task.title}" is overdue. ` +
        `Current status: ${task.status}. ` +
        `Due date: ${task.due_at}. Please review it.`;

      for (const recipient of recipients.rows) {
        await client.query(
          `
          INSERT INTO notifications
            (user_id, title, message)
          VALUES ($1, $2, $3)
          `,
          [recipient.id, title, message]
        );

        notificationCount++;
      }

      // Record the time this reminder was processed
      await client.query(
        `
        UPDATE tasks
        SET last_overdue_reminder_at = NOW()
        WHERE id = $1
        `,
        [task.id]
      );
    }

    await client.query("COMMIT");

    console.log(
      `Overdue reminder job completed. ` +
      `${tasks.rowCount} tasks processed, ` +
      `${notificationCount} notifications created.`
    );

    return {
      tasksProcessed: tasks.rowCount,
      notificationsCreated: notificationCount
    };

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Overdue reminder job failed:", error);

    throw error;

  } finally {
    client.release();
  }
};

// Schedule the job to run once every hour
export const startOverdueReminderJob = () => {
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        await runOverdueReminderJob();
      } catch (error) {
        console.error(
          "Scheduled overdue reminder error:",
          error.message
        );
      }
    },
    {
      timezone: process.env.TZ || "Asia/Kolkata"
    }
  );

  console.log("Overdue reminder scheduler started.");
};
