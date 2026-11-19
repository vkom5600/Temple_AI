-- How many automatic (hourly) reminders a task has had, so the job stops after 3.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_reminder_count INT NOT NULL DEFAULT 0;
