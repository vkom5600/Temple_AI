-- Who sent the last reminder, so the staff phone can say "Raghu sent a reminder".
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reminded_by INT REFERENCES users(id) ON DELETE SET NULL;
