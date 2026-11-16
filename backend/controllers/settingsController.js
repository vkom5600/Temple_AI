import { logAudit } from "../services/auditService.js";
import { SETTING_KEYS, getAllSettings, setSetting } from "../services/settingsService.js";

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
