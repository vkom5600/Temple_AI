-- W2 sign-up form: when they can come, how they'd like to help, and when they agreed
-- to the Temple Rules. Shown to the committee in the sign-up review (P5) and on P2.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_details JSONB;
