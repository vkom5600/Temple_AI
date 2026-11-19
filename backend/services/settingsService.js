import pool from "../config/db.js";

// Chairman-controlled switches stored in the settings table.
// Only keys listed here can be read or changed through the API.
export const SETTING_KEYS = {
  registration_open: { type: "boolean", label: "Allow new people to register" },
  registration_roles: { type: "roles", label: "Who can sign up" },
  registration_opens: { type: "date", label: "Sign-ups open on" },
  registration_closes: { type: "date", label: "Sign-ups close after" },
  login_alert_to_chairman: { type: "boolean", label: "Email the chairman when someone signs in" },
  closing_time: { type: "time", label: "Evening closing check" }
};

const parse = (key, raw) =>
  SETTING_KEYS[key]?.type === "boolean" ? raw === "true" : raw;

export const getSetting = async (key, fallback = null) => {
  const result = await pool.query(
    "SELECT setting_value FROM settings WHERE setting_key = $1",
    [key]
  );
  return result.rows[0] ? parse(key, result.rows[0].setting_value) : fallback;
};

export const getAllSettings = async () => {
  const result = await pool.query(
    `SELECT setting_key, setting_value, updated_at
     FROM settings
     WHERE setting_key = ANY($1::varchar[])`,
    [Object.keys(SETTING_KEYS)]
  );

  return result.rows.map((row) => ({
    key: row.setting_key,
    value: parse(row.setting_key, row.setting_value),
    label: SETTING_KEYS[row.setting_key].label,
    updated_at: row.updated_at
  }));
};

export const setSetting = async (key, value, updatedBy) => {
  await pool.query(
    `INSERT INTO settings (setting_key, setting_value, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (setting_key) DO UPDATE
     SET setting_value = EXCLUDED.setting_value,
         updated_by = EXCLUDED.updated_by`,
    [key, String(value), updatedBy]
  );
};

// ---------------------------------------------------------------- P4 sign-up window

export const SIGNUP_ROLES = ["volunteer", "staff", "committee"];

const templeToday = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: process.env.TEMPLE_TIMEZONE || "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

// The window as people see it: open only if switched on, today is within the
// dates (closes by itself), and at least one group may sign up.
export const getSignupWindow = async () => {
  const on = await getSetting("registration_open", true);
  const roles = String(await getSetting("registration_roles", "volunteer,staff") ?? "").split(",").filter((r) => SIGNUP_ROLES.includes(r));
  const opens = (await getSetting("registration_opens", "")) || null;
  const closes = (await getSetting("registration_closes", "")) || null;
  const today = templeToday();
  const notYet = !!opens && today < opens;
  const ended = !!closes && today > closes;
  return {
    switched_on: on,
    open: on && roles.length > 0 && !notYet && !ended,
    roles,
    opens,
    closes,
    next_opens: on && notYet ? opens : null,
    reason: !on ? "off" : !roles.length ? "no_roles" : notYet ? "not_yet" : ended ? "ended" : null
  };
};
