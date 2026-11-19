import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { DESIGNATIONS } from "../utils/userValidation.js";

// H3 Broadcast: one message to staff and volunteer phones (design: 06_H3_broadcast).
// Staff see the newest one at the top of their phone ("Message from Raghu").
const AUDIENCES = {
    everyone: ["staff", "volunteer", "committee", "chairman"],
    staff: ["staff"],
    volunteer: ["volunteer"],
    committee: ["committee", "chairman"]
};

// POST /api/notifications/broadcast  (chairman, committee)
// { audience: everyone|staff|volunteer|committee, designations?: ["priest"], message, urgent? }
export const sendBroadcast = async (req, res) => {
    const { audience = "everyone", designations = [], urgent = false } = req.body ?? {};
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!AUDIENCES[audience]) {
        return res.status(400).json({ success: false, message: `audience must be one of: ${Object.keys(AUDIENCES).join(", ")}` });
    }
    if (!message || message.length > 280) {
        return res.status(400).json({ success: false, message: "Please write a message (up to 280 characters)" });
    }
    if (!Array.isArray(designations) || designations.some((d) => !DESIGNATIONS.includes(d))) {
        return res.status(400).json({ success: false, message: "Unknown job in designations" });
    }

    const first = req.user.full_name.split(" ")[0];
    // Picking jobs narrows "All staff" to those jobs; otherwise everyone in the audience.
    const target = designations.length ? { designations } : { roles: AUDIENCES[audience] };
    const sent = await notify({
        ...target,
        excludeUserId: req.user.id,
        title: `Message from ${first}`,
        message,
        type: urgent ? "broadcast_urgent" : "broadcast"
    });

    await logAudit({
        actorId: req.user.id,
        action: "broadcast.sent",
        entityType: "broadcast",
        details: { audience, designations, urgent: Boolean(urgent), recipients: sent.length, message: message.slice(0, 80) }
    });

    res.status(201).json({
        success: true,
        count: sent.length,
        message: sent.length ? `Sent to ${sent.length} ${sent.length === 1 ? "person" : "people"}` : "Nobody matched those recipients"
    });
};

// POST /api/notifications/message  (chairman, committee)  { user_ids: [..], message }
// A direct message to one or a few people (P2 "Message Ramesh", People "Remind").
// It shows on their phone like a broadcast ("Message from Raghu").
export const sendDirect = async (req, res) => {
    const ids = Array.isArray(req.body?.user_ids) ? [...new Set(req.body.user_ids.map(Number).filter(Number.isInteger))].slice(0, 50) : [];
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!ids.length) return res.status(400).json({ success: false, message: "Choose who to message" });
    if (!message || message.length > 280) return res.status(400).json({ success: false, message: "Please write a message (up to 280 characters)" });

    const sent = await notify({
        userIds: ids,
        excludeUserId: req.user.id,
        title: `Message from ${req.user.full_name.split(" ")[0]}`,
        message,
        type: "broadcast"
    });
    await logAudit({ actorId: req.user.id, action: "message.sent", entityType: "broadcast", details: { recipients: sent.length, message: message.slice(0, 80) } });
    res.status(201).json({ success: true, count: sent.length, message: sent.length === 1 ? "Message sent" : `Sent to ${sent.length} people` });
};
