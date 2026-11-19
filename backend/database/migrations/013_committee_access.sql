-- P2 "What Meena can see and do": committee access per area (Off / View / Manage)
-- plus broadcast and AI switches. NULL = the defaults (what committee had before).
ALTER TABLE users ADD COLUMN IF NOT EXISTS access JSONB;
