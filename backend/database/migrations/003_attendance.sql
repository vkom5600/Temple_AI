-- =========================================================
-- 003 ATTENDANCE (Phase 2)
-- One row per person per day (temple time zone).
-- =========================================================

-- ---------------------------------------------------------
-- ATTENDANCE
-- status:   present (came in) / absent (marked by an admin)
-- check_in: first arrival that day
-- check_out: when they last left; NULL while they're on site.
--           "I'm back" clears it again.
-- Closing (from the last person out):
--   closing_checks       {"lamps": true, "gas": true, "doors": false}
--   closing_confirmed_at all three ticked
--   closing_skipped      left as last person without ticking everything
--                        (the chairman is told)
-- updated_by: who last changed it (themselves, or an admin correcting it)
-- ---------------------------------------------------------
CREATE TABLE attendance (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date         DATE NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'present'
                                CHECK (status IN ('present', 'absent')),
    check_in                TIMESTAMPTZ,
    check_out               TIMESTAMPTZ,
    closing_checks          JSONB,
    closing_confirmed_at    TIMESTAMPTZ,
    closing_skipped         BOOLEAN NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    updated_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, attendance_date),
    CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in),
    -- someone marked absent has no times
    CHECK (status = 'present' OR (check_in IS NULL AND check_out IS NULL))
);

CREATE INDEX idx_attendance_date ON attendance(attendance_date);

CREATE TRIGGER trg_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Closing time for the evening check (HH:MM, temple time).
INSERT INTO settings (setting_key, setting_value, category)
VALUES ('closing_time', '21:00', 'attendance')
ON CONFLICT (setting_key) DO NOTHING;
