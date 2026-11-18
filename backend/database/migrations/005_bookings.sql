-- =========================================================
-- 005: Phase 3 bookings (designs M7, M13, AC2, AC4, C1, C3, C4)
--
-- Two ways to book (committee meeting, 19 Nov):
--   mobile – staff and volunteers request a space on their phone (M7);
--            it waits for the chairman or committee to approve (AC2)
--   desk   – the office books straight from the tablet / computer (C4),
--            confirmed at once
-- "One view – allocation": every resource and who has it when.
-- =========================================================

-- Halls, rooms and other spaces that can be booked ("resources")
CREATE TABLE resources (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    kind        VARCHAR(20) NOT NULL DEFAULT 'room'
                    CHECK (kind IN ('hall', 'room', 'mandir', 'kitchen', 'space', 'other')),
    capacity    INTEGER CHECK (capacity IS NULL OR capacity > 0),
    notes       VARCHAR(300),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AC4 Temple Rules. ask_requester = the person booking must tick it (M7 checklist).
CREATE TABLE temple_rules (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(40) NOT NULL DEFAULT 'Bookings & halls',
    text            VARCHAR(300) NOT NULL,
    ask_requester   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER temple_rules_updated_at BEFORE UPDATE ON temple_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bookings (
    id              SERIAL PRIMARY KEY,
    resource_id     INTEGER NOT NULL REFERENCES resources(id),
    kind            VARCHAR(10) NOT NULL DEFAULT 'booking'
                        CHECK (kind IN ('booking', 'event')),   -- event = the temple runs it
    title           VARCHAR(200) NOT NULL,                      -- "What is it for?"
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    guests          INTEGER CHECK (guests IS NULL OR guests >= 0),
    food            BOOLEAN NOT NULL DEFAULT FALSE,             -- vegetarian food served
    contact_name    VARCHAR(120),
    contact_phone   VARCHAR(30),
    contact_email   VARCHAR(255),
    organisation    VARCHAR(120),
    notes           TEXT,
    deposit_paid    BOOLEAN NOT NULL DEFAULT FALSE,

    status          VARCHAR(12) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
    source          VARCHAR(10) NOT NULL CHECK (source IN ('mobile', 'desk')),
    requested_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,

    rules_agreed    JSONB NOT NULL DEFAULT '[]'::jsonb,          -- ids of the rules they ticked
    rules_agreed_at TIMESTAMPTZ,

    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    decision_note   TEXT,                                        -- reason for declining / cancelling
    google_event_id VARCHAR(255),                                -- set when Google Calendar sync is on

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (ends_at > starts_at)
);

CREATE INDEX idx_bookings_resource_time ON bookings(resource_id, starts_at);
CREATE INDEX idx_bookings_status ON bookings(status, starts_at);
CREATE INDEX idx_bookings_requested_by ON bookings(requested_by);

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Prep tasks made when a booking is approved (AC2 "Approving adds these tasks")
ALTER TABLE tasks ADD COLUMN booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_booking ON tasks(booking_id);
