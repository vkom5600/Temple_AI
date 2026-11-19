-- P2 "Remove person": a soft remove. They can't sign in and drop off the People
-- list, but their past tasks, attendance and the activity log keep their name.
ALTER TABLE users ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
