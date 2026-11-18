import pool from "../config/db.js";
import { ADMIN_ROLES } from "../middleware/authMiddleware.js";
import { logAudit } from "../services/auditService.js";
import { parseId } from "../utils/userValidation.js";

// Halls and rooms ("resources") and the AC4 Temple Rules.

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const KINDS = ["hall", "room", "mandir", "kitchen", "space", "other"];
const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// ---------------------------------------------------------------- resources

// GET /api/resources   everyone (active only); admins ?all=1 for switched-off ones too
export const getResources = async (req, res) => {
    const all = req.query.all === "1" && ADMIN_ROLES.includes(req.user.role);
    const result = await pool.query(
        `SELECT * FROM resources ${all ? "" : "WHERE is_active"} ORDER BY sort_order, name`
    );
    res.json({ success: true, resources: result.rows });
};

const resourceBody = (body) => {
    const name = text(body.name, 80);
    if (!name) return { error: "Give the space a name" };
    const kind = KINDS.includes(body.kind) ? body.kind : "room";
    const capacity = body.capacity === "" || body.capacity === null || body.capacity === undefined ? null : Number(body.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return { error: "Capacity must be a whole number" };
    return { data: { name, kind, capacity, notes: text(body.notes, 300), is_active: body.is_active !== false, sort_order: Number(body.sort_order) || 0 } };
};

// POST /api/resources  (chairman)
export const createResource = async (req, res) => {
    const { data, error } = resourceBody(req.body ?? {});
    if (error) return fail(res, 400, error);
    try {
        const r = await pool.query(
            `INSERT INTO resources (name, kind, capacity, notes, is_active, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.name, data.kind, data.capacity, data.notes, data.is_active, data.sort_order]
        );
        await logAudit({ actorId: req.user.id, action: "resource.created", entityType: "resource", entityId: r.rows[0].id, details: { name: data.name } });
        res.status(201).json({ success: true, resource: r.rows[0], message: `${data.name} added` });
    } catch (err) {
        if (err.code === "23505") return fail(res, 409, "There's already a space with that name");
        throw err;
    }
};

// PUT /api/resources/:id  (chairman)
export const updateResource = async (req, res) => {
    const id = parseId(req.params.id);
    const { data, error } = resourceBody(req.body ?? {});
    if (!id) return fail(res, 404, "Space not found");
    if (error) return fail(res, 400, error);
    try {
        const r = await pool.query(
            `UPDATE resources SET name=$1, kind=$2, capacity=$3, notes=$4, is_active=$5, sort_order=$6 WHERE id=$7 RETURNING *`,
            [data.name, data.kind, data.capacity, data.notes, data.is_active, data.sort_order, id]
        );
        if (!r.rowCount) return fail(res, 404, "Space not found");
        await logAudit({ actorId: req.user.id, action: "resource.updated", entityType: "resource", entityId: id, details: { name: data.name, is_active: data.is_active } });
        res.json({ success: true, resource: r.rows[0], message: "Saved" });
    } catch (err) {
        if (err.code === "23505") return fail(res, 409, "There's already a space with that name");
        throw err;
    }
};

// ---------------------------------------------------------------- Temple Rules (AC4)

// GET /api/rules   everyone (active); admins ?all=1 includes switched-off rules
export const getRules = async (req, res) => {
    const all = req.query.all === "1" && ADMIN_ROLES.includes(req.user.role);
    const rules = await pool.query(
        `SELECT tr.*, u.full_name AS updated_by_name FROM temple_rules tr
         LEFT JOIN users u ON u.id = tr.updated_by
         ${all ? "" : "WHERE tr.is_active"} ORDER BY tr.category, tr.sort_order, tr.id`
    );
    res.json({ success: true, rules: rules.rows });
};

const ruleBody = (body) => {
    const ruleText = text(body.text, 300);
    if (!ruleText) return { error: "Write the rule" };
    return {
        data: {
            text: ruleText,
            category: text(body.category, 40) ?? "Bookings & halls",
            ask_requester: Boolean(body.ask_requester),
            is_active: body.is_active !== false,
            sort_order: Number(body.sort_order) || 0
        }
    };
};

// POST /api/rules  (chairman, committee)
export const createRule = async (req, res) => {
    const { data, error } = ruleBody(req.body ?? {});
    if (error) return fail(res, 400, error);
    const r = await pool.query(
        `INSERT INTO temple_rules (text, category, ask_requester, is_active, sort_order, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [data.text, data.category, data.ask_requester, data.is_active, data.sort_order, req.user.id]
    );
    await logAudit({ actorId: req.user.id, action: "rule.created", entityType: "rule", entityId: r.rows[0].id, details: { text: data.text } });
    res.status(201).json({ success: true, rule: r.rows[0], message: "Rule added" });
};

// PUT /api/rules/:id  (chairman, committee). is_active: false switches a rule off.
export const updateRule = async (req, res) => {
    const id = parseId(req.params.id);
    const { data, error } = ruleBody(req.body ?? {});
    if (!id) return fail(res, 404, "Rule not found");
    if (error) return fail(res, 400, error);
    const r = await pool.query(
        `UPDATE temple_rules SET text=$1, category=$2, ask_requester=$3, is_active=$4, sort_order=$5, updated_by=$6
         WHERE id=$7 RETURNING *`,
        [data.text, data.category, data.ask_requester, data.is_active, data.sort_order, req.user.id, id]
    );
    if (!r.rowCount) return fail(res, 404, "Rule not found");
    await logAudit({ actorId: req.user.id, action: "rule.updated", entityType: "rule", entityId: id, details: { text: data.text, is_active: data.is_active } });
    res.json({ success: true, rule: r.rows[0], message: data.is_active ? "Rule saved" : "Rule switched off" });
};
