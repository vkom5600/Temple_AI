-- M6 "Ask a question": a staff member or volunteer asks the committee something,
-- and gets the answer on their phone. Shows in the Action Center until answered.
CREATE TABLE IF NOT EXISTS questions (
    id           SERIAL PRIMARY KEY,
    asked_by     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question     TEXT NOT NULL,
    task_id      INT REFERENCES tasks(id) ON DELETE SET NULL,
    answer       TEXT,
    answered_by  INT REFERENCES users(id) ON DELETE SET NULL,
    answered_at  TIMESTAMPTZ,
    seen_at      TIMESTAMPTZ,              -- when the asker saw the answer
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_open ON questions (answered_at, created_at);
CREATE INDEX IF NOT EXISTS idx_questions_asked_by ON questions (asked_by, created_at DESC);
