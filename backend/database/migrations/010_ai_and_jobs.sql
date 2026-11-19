-- Phase 4 jobs and Temple AI notes.
-- Nightly report: one row per day, written at 00:05 for the day before.
CREATE TABLE IF NOT EXISTS daily_reports (
    report_date  DATE PRIMARY KEY,
    facts        JSONB NOT NULL,
    summary      TEXT NOT NULL,
    written_by   VARCHAR(10) NOT NULL CHECK (written_by IN ('ai', 'rules')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AC2: Temple AI's short note on a booking request (written once, while it's pending).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ai_note TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ai_note_at TIMESTAMPTZ;

-- Automatic reminders for overdue tasks (chairman can switch them off in Settings).
INSERT INTO settings (setting_key, setting_value, category) VALUES
    ('auto_reminders', 'true', 'tasks'),
    ('nightly_report', 'true', 'reports')
ON CONFLICT (setting_key) DO NOTHING;
