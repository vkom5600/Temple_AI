-- W1: anyone can request a hall or room from the website, without signing in.
-- These requests have source 'web' and no requested_by user.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_source_check CHECK (source IN ('mobile', 'desk', 'web'));
