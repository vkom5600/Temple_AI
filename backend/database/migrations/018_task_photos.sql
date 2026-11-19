-- Photos on tasks (T1/T5 "1 photo"): staff attach a photo when they do a task;
-- the committee sees it when reviewing. Stored in the database (hosted servers can
-- lose files on restart). The phone shrinks photos to ~1280px before upload.
CREATE TABLE IF NOT EXISTS task_photos (
    id           SERIAL PRIMARY KEY,
    task_id      INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by  INT REFERENCES users(id) ON DELETE SET NULL,
    mime         VARCHAR(30) NOT NULL,
    data         BYTEA NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_photos_task ON task_photos (task_id);
