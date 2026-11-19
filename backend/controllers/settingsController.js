import { logAudit } from "../services/auditService.js";
import { SETTING_KEYS, SIGNUP_ROLES, getAllSettings, getSignupWindow, setSetting } from "../services/settingsService.js";
import pool from "../config/db.js";

// GET /api/settings  (chairman)
export const listSettings = async (req, res) => {
    res.json({
        success: true,
        settings: await getAllSettings()
    });
};

// PUT /api/settings/:key  (chairman)  body: { value }
export const updateSetting = async (req, res) => {
    const { key } = req.params;
    const definition = SETTING_KEYS[key];
    const { value } = req.body ?? {};

    if (!definition) {
        return res.status(404).json({ success: false, message: "Unknown setting" });
    }

    if (definition.type === "boolean" && typeof value !== "boolean") {
        return res.status(400).json({ success: false, message: "Value must be true or false" });
    }

    if (definition.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        return res.status(400).json({ success: false, message: "Time must be HH:MM (24-hour)" });
    }

    await setSetting(key, value, req.user.id);

    await logAudit({
        actorId: req.user.id,
        action: "setting.updated",
        entityType: "setting",
        details: { key, value }
    });

    res.json({
        success: true,
        message: "Setting saved",
        settings: await getAllSettings()
    });
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/settings/signup-window  (chairman, committee)
export const getSignupWindowSettings = async (req, res) => {
    const pending = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE approval_status = 'pending' AND removed_at IS NULL");
    res.json({ success: true, window: await getSignupWindow(), pending: pending.rows[0].n });
};

// PUT /api/settings/signup-window  (chairman)  body: { open, roles, opens, closes }   (P4)
export const updateSignupWindow = async (req, res) => {
    const { open, roles, opens, closes } = req.body ?? {};
    if (typeof open !== "boolean") return res.status(400).json({ success: false, message: "Say whether sign-ups are open" });
    if (!Array.isArray(roles) || roles.some((r) => !SIGNUP_ROLES.includes(r))) {
        return res.status(400).json({ success: false, message: "Choose who can sign up: volunteers, staff or committee" });
    }
    for (const d of [opens, closes]) {
        if (d && !DATE.test(d)) return res.status(400).json({ success: false, message: "Dates must be YYYY-MM-DD" });
    }
    if (opens && closes && closes < opens) return res.status(400).json({ success: false, message: "The closing date must be after the opening date" });
    if (open && !roles.length) return res.status(400).json({ success: false, message: "Pick at least one group who can sign up, or close sign-ups" });

    await setSetting("registration_open", open, req.user.id);
    await setSetting("registration_roles", [...new Set(roles)].join(","), req.user.id);
    await setSetting("registration_opens", opens || "", req.user.id);
    await setSetting("registration_closes", closes || "", req.user.id);
    await logAudit({ actorId: req.user.id, action: "setting.updated", entityType: "setting", details: { key: "signup_window", open, roles, opens, closes } });

    const window = await getSignupWindow();
    res.json({
        success: true,
        window,
        message: !open ? "Sign-ups closed" : window.open ? "Sign-up window saved. People can sign up now." : window.next_opens ? `Saved. Sign-ups open on ${new Date(`${window.next_opens}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}.` : "Saved, but the window has already ended. Change the dates to open it."
    });
};
