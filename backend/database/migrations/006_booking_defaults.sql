-- =========================================================
-- 006: starting halls, rooms and Temple Rules (from the designs M7, AC2, AC4)
-- The chairman can rename, add and switch these off in the app.
-- The committee said there are 10 resources in all (6 + 2 + 1 + 1): add the rest
-- under Calendar → Allocation → "Halls & rooms".
-- =========================================================

INSERT INTO resources (name, kind, capacity, notes, sort_order) VALUES
    ('Main Mandir',    'mandir',  NULL, 'Not bookable during aarti times', 10),
    ('Shivaji Hall',   'hall',    120,  NULL, 20),
    ('Community Hall', 'hall',    80,   NULL, 30),
    ('Room G37',       'room',    25,   'Meeting room', 40),
    ('Room G38',       'room',    20,   'Meeting room', 50),
    ('Kitchen',        'kitchen', NULL, 'Needs a trained volunteer present', 60)
ON CONFLICT (name) DO NOTHING;

-- ask_requester = the person booking ticks it before they can send (M7 "6 of 6")
INSERT INTO temple_rules (category, text, ask_requester, sort_order) VALUES
    ('Bookings & halls', 'Vegetarian food only, no alcohol. No meat, eggs or alcohol in the temple.', TRUE, 10),
    ('Bookings & halls', 'Shoes off inside the hall. Shoe racks are by the entrance.', TRUE, 20),
    ('Bookings & halls', 'Finish and leave by 9:00 pm on weekdays and 10:00 pm at weekends.', TRUE, 30),
    ('Bookings & halls', 'A named contact on the day, and the deposit paid.', TRUE, 40),
    ('Bookings & halls', 'Park only in the temple car park, not on the road.', TRUE, 50),
    ('Bookings & halls', 'Leave the hall clean and tidy. Bins outside, tables wiped.', TRUE, 60),
    ('Bookings & halls', 'Weekly or repeating bookings need committee approval.', FALSE, 70),
    ('Stalls & vendors', 'Stalls are allowed on festival days only.', FALSE, 10),
    ('Stalls & vendors', 'Food stalls must be from vendors registered with the temple.', FALSE, 20),
    ('Stalls & vendors', 'Food stalls need a valid Food Hygiene certificate.', FALSE, 30),
    ('Kitchen & spaces', 'Kitchen use needs a trained volunteer present.', FALSE, 10),
    ('Kitchen & spaces', 'Main Mandir is not bookable during aarti times.', FALSE, 20);
