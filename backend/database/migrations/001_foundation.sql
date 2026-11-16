-- =========================================================
-- 001 FOUNDATION (Phase 1)
-- users, staff_profiles, notifications, audit_logs
-- =========================================================

-- Keeps updated_at current on any table that has the column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------
-- USERS
-- role = access level (what you are allowed to do).
-- The job someone does (priest, cook, ...) lives in
-- staff_profiles.designation.
--
-- approval_status: people who register themselves start as
-- 'pending' until the chairman approves or rejects them.
-- People the chairman adds directly are 'approved' at once.
-- Only approved AND active users can sign in.
-- ---------------------------------------------------------
CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    full_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(150) NOT NULL UNIQUE
                            CHECK (email = LOWER(email)),
    password_hash       TEXT NOT NULL,
    role                VARCHAR(20) NOT NULL
                            CHECK (role IN ('chairman', 'committee', 'staff', 'volunteer')),
    phone               VARCHAR(20),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    approval_status     VARCHAR(20) NOT NULL DEFAULT 'approved'
                            CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    reviewed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role) WHERE is_active;
CREATE INDEX idx_users_pending ON users(created_at) WHERE approval_status = 'pending';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------
-- STAFF PROFILES (one per user)
-- designation is used in Phase 2 to assign a task to
-- everyone doing a job (e.g. all cleaners).
-- ---------------------------------------------------------
CREATE TABLE staff_profiles (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE
                            REFERENCES users(id) ON DELETE CASCADE,
    designation         VARCHAR(30)
                            CHECK (designation IN (
                                'priest', 'cook', 'cleaner',
                                'caretaker', 'security', 'maintenance'
                            )),
    emergency_contact   VARCHAR(150),
    joining_date        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_profiles_designation ON staff_profiles(designation);

CREATE TRIGGER trg_staff_profiles_updated_at
    BEFORE UPDATE ON staff_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------
-- NOTIFICATIONS (in-app; the bell)
-- ---------------------------------------------------------
CREATE TABLE notifications (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(200) NOT NULL,
    message             TEXT,
    notification_type   VARCHAR(30) NOT NULL DEFAULT 'general',
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);

-- ---------------------------------------------------------
-- AUDIT LOGS (who did what, when)
-- details holds anything useful, e.g. { "before": {...}, "after": {...} }
-- ---------------------------------------------------------
CREATE TABLE audit_logs (
    id              SERIAL PRIMARY KEY,
    actor_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       INTEGER,
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ---------------------------------------------------------
-- SETTINGS (chairman-controlled switches)
-- Values are text; booleans are 'true' / 'false'.
-- ---------------------------------------------------------
CREATE TABLE settings (
    id              SERIAL PRIMARY KEY,
    setting_key     VARCHAR(100) NOT NULL UNIQUE,
    setting_value   TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'general',
    updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO settings (setting_key, setting_value, category) VALUES
    ('registration_open',         'true', 'access'),   -- can new people register?
    ('login_alert_to_chairman',   'true', 'email');    -- email the chairman when someone signs in
