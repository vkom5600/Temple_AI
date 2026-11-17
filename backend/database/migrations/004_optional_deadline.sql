-- =========================================================
-- 004: tasks can have no deadline (designs T3 "No deadline", M2 "Any time")
-- A task with no deadline is never overdue and shows on today's list until done.
-- Repeating tasks still need a time, because each copy is made for a time.
-- =========================================================

ALTER TABLE tasks ALTER COLUMN due_at DROP NOT NULL;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_repeat_needs_time CHECK (recurrence = 'none' OR due_at IS NOT NULL);
