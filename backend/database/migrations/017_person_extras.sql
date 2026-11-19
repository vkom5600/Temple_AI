-- P2 design extras: keys a person holds, their usual shift, and notes for the committee.
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS keyholder VARCHAR(160);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS shift_pattern VARCHAR(120);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS notes TEXT;
