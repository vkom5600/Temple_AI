-- =========================================================
-- 002 TASKS + ISSUES (Phase 2)
-- tasks, task_comments, issues
-- =========================================================

-- ---------------------------------------------------------
-- TASKS
-- Assigned EITHER to one person (assigned_to) OR to a group
-- (assigned_group): a job such as 'cleaner', or 'staff',
-- 'volunteer', 'committee'. A group task is ONE shared task:
-- whoever in the group does it, it's done for everyone.
--
-- status:
--   todo              waiting to be done
--   awaiting_signoff  done, but a safety task: a second person must check
--   done              finished (signed off, if it needed it)
--   flagged           "can't do this" - an issue was opened
--   cancelled         withdrawn by an admin
--
-- Repeating tasks: every copy shares series_id (the first copy's id).
-- A job creates the next copy each day/week from the latest one.
-- ---------------------------------------------------------
CREATE TABLE tasks (
    id                      SERIAL PRIMARY KEY,
    title                   VARCHAR(200) NOT NULL,
    description             TEXT,
    category                VARCHAR(50) NOT NULL DEFAULT 'General',
    area                    VARCHAR(100),

    assigned_to             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_group          VARCHAR(30)
                                CHECK (assigned_group IN (
                                    'priest', 'cook', 'cleaner', 'caretaker',
                                    'security', 'maintenance',
                                    'staff', 'volunteer', 'committee'
                                )),

    priority                VARCHAR(10) NOT NULL DEFAULT 'normal'
                                CHECK (priority IN ('low', 'normal', 'high')),
    requires_verification   BOOLEAN NOT NULL DEFAULT FALSE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'todo'
                                CHECK (status IN (
                                    'todo', 'awaiting_signoff', 'done',
                                    'flagged', 'cancelled'
                                )),
    due_at                  TIMESTAMPTZ NOT NULL,

    recurrence              VARCHAR(10) NOT NULL DEFAULT 'none'
                                CHECK (recurrence IN ('none', 'daily', 'weekly')),
    series_id               INTEGER REFERENCES tasks(id) ON DELETE SET NULL,

    completed_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_at            TIMESTAMPTZ,
    verified_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at             TIMESTAMPTZ,
    last_reminded_at        TIMESTAMPTZ,
    reminder_count          INTEGER NOT NULL DEFAULT 0,

    created_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- exactly one kind of assignee (a person whose account is deleted leaves it unassigned)
    CHECK (assigned_to IS NULL OR assigned_group IS NULL),
    -- the person who did a safety task can never be the one who signs it off
    CHECK (verified_by IS NULL OR verified_by IS DISTINCT FROM completed_by)
);

CREATE INDEX idx_tasks_status_due ON tasks(status, due_at);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_group ON tasks(assigned_group);
-- one copy per series per due time (stops the repeat job creating doubles)
CREATE UNIQUE INDEX idx_tasks_series_due ON tasks(series_id, due_at) WHERE series_id IS NOT NULL;

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------
-- TASK COMMENTS
-- comment_type: 'comment' (someone wrote it), 'sent_back' (sign-off
-- refused, with what's wrong), 'flagged' (couldn't do it),
-- 'system' (e.g. "problem sorted, please try again").
-- ---------------------------------------------------------
CREATE TABLE task_comments (
    id              SERIAL PRIMARY KEY,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    comment         TEXT NOT NULL,
    comment_type    VARCHAR(20) NOT NULL DEFAULT 'comment'
                        CHECK (comment_type IN ('comment', 'sent_back', 'flagged', 'system')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);

-- ---------------------------------------------------------
-- ISSUES
-- A problem anyone reports, or "I couldn't do this task" (task_id set).
-- status: open -> resolved (sorted, no task needed)
--              -> converted (an admin turned it into created_task_id)
-- ---------------------------------------------------------
CREATE TABLE issues (
    id                  SERIAL PRIMARY KEY,
    reported_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    task_id             INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    category            VARCHAR(50) NOT NULL,
    description         TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'resolved', 'converted')),
    resolved_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ,
    resolution_note     TEXT,
    created_task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issues_status ON issues(status, created_at DESC);

CREATE TRIGGER trg_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
