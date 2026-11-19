-- H2 festival days (Phase 4). The committee keeps this list (Calendar → Festivals).
-- confirmed = false means "date to confirm with the priest" (seeded examples start that way).
CREATE TABLE IF NOT EXISTS festivals (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    subtitle      VARCHAR(160),                 -- "Festival of Lights"
    festival_date DATE NOT NULL,
    kind          VARCHAR(20) NOT NULL DEFAULT 'festival' CHECK (kind IN ('festival', 'observance')),
    opens         TIME,                         -- extended hours that day, if any
    closes        TIME,
    confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
    remind        BOOLEAN NOT NULL DEFAULT TRUE, -- "Diwali is in 6 weeks..." on Home
    snoozed_until DATE,                         -- "Later" / "Not this year"
    created_by    INT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_festivals_date ON festivals (festival_date);
