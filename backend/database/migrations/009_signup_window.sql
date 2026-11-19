-- P4 Sign-up window: who can sign up and when. "registration_open" stays the
-- main switch; these narrow it down. Dates are temple-local days (YYYY-MM-DD).
INSERT INTO settings (setting_key, setting_value, category) VALUES
    ('registration_roles',  'volunteer,staff', 'access'),
    ('registration_opens',  '',                'access'),
    ('registration_closes', '',                'access')
ON CONFLICT (setting_key) DO NOTHING;
