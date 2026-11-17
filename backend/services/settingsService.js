import pool from "../config/db.js";

// Chairman-controlled switches stored in the settings table.
// Only keys listed here can be read or changed through the API.
export const SETTING_KEYS = {
  registration_open: { type: "boolean", label: "Allow new people to register" },
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
