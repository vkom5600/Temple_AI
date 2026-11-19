import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { sendEmail } from "../services/emailService.js";
import * as emails from "../services/emailTemplates.js";
import { parseId, validateUserBody } from "../utils/userValidation.js";
import { effectiveAccess, validateAccess } from "../middleware/access.js";

const USER_COLUMNS = `
    u.id, u.full_name, u.email, u.role, u.phone, u.is_active,
    u.approval_status, u.reviewed_at, u.rejection_reason, u.created_at,
    sp.designation, sp.emergency_contact, sp.joining_date, sp.keyholder, sp.shift_pattern, sp.notes, u.access, u.signup_details
`;

const findUser = async (id, db = pool) => {
    if (!id) return null;

    const result = await db.query(
        `SELECT ${USER_COLUMNS}
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.id = $1`,
        [id]
    );
    return result.rows[0] ?? null;
};

const notFound = (res) =>
    res.status(404).json({ success: false, message: "User not found" });

// GET /api/users  (chairman, committee)
// Optional ?status=pending|approved|rejected
export const getUsers = async (req, res) => {
    const { status } = req.query;
    const values = [];
    let where = "WHERE u.removed_at IS NULL";

    if (["pending", "approved", "rejected"].includes(status)) {
        values.push(status);
        where += " AND u.approval_status = $1";
    }

    const result = await pool.query(
        `SELECT ${USER_COLUMNS}
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         ${where}
         ORDER BY u.is_active DESC, u.full_name`,
        values
    );

    res.json({
        success: true,
        count: result.rowCount,
        users: result.rows
    });
};

// GET /api/users/:id  (chairman, committee)
export const getUserById = async (req, res) => {
    const user = await findUser(parseId(req.params.id));
    if (!user) return notFound(res);

    res.json({ success: true, user });
};

// POST /api/users  (chairman) – adds someone directly, already approved.
export const createUser = async (req, res) => {
    const { error, data } = validateUserBody(req.body, { requirePassword: true });

    if (error) {
        return res.status(400).json({ success: false, message: error });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const client = await pool.connect();
    let user;

    try {
        await client.query("BEGIN");

        const inserted = await client.query(
            `INSERT INTO users
                (full_name, email, password_hash, role, phone,
                 approval_status, reviewed_by, reviewed_at)
             VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW())
             RETURNING id`,
            [data.full_name, data.email, passwordHash, data.role, data.phone, req.user.id]
        );
        const id = inserted.rows[0].id;

        await client.query(
            `INSERT INTO staff_profiles
                (user_id, designation, emergency_contact, joining_date, keyholder, shift_pattern, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, data.designation, data.emergency_contact, data.joining_date, data.keyholder, data.shift_pattern, data.notes]
        );

        user = await findUser(id, client);

        await logAudit({
            actorId: req.user.id,
            action: "user.created",
            entityType: "user",
            entityId: id,
            details: { role: data.role, designation: data.designation }
        }, client);

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "23505") {
            return res.status(409).json({ success: false, message: "Email already exists" });
        }
        throw err;
    } finally {
        client.release();
    }

    await notify({
        userId: user.id,
        title: `Welcome, ${user.full_name}`,
        message: `${req.user.full_name} added you to the temple team.`,
        type: "account"
    });

    res.status(201).json({
        success: true,
        message: "User created successfully",
        user
    });
};

// PUT /api/users/:id  (chairman). Send "password" only to reset it.
export const updateUser = async (req, res) => {
    const id = parseId(req.params.id);
    const before = await findUser(id);
    if (!before) return notFound(res);

    if (before.role === "chairman") {
        return res.status(403).json({
            success: false,
            message: "The chairman account can't be changed here"
        });
    }

    const { error, data } = validateUserBody(req.body, { requirePassword: false });

    if (error) {
        return res.status(400).json({ success: false, message: error });
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null;
    const client = await pool.connect();
    let user;

    try {
        await client.query("BEGIN");

        await client.query(
            `UPDATE users
             SET full_name = $1, email = $2, role = $3, phone = $4,
                 password_hash = COALESCE($5, password_hash)
             WHERE id = $6`,
            [data.full_name, data.email, data.role, data.phone, passwordHash, id]
        );

        await client.query(
            `INSERT INTO staff_profiles
                (user_id, designation, emergency_contact, joining_date, keyholder, shift_pattern, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id) DO UPDATE
             SET designation = EXCLUDED.designation,
                 emergency_contact = EXCLUDED.emergency_contact,
                 joining_date = EXCLUDED.joining_date,
                 keyholder = EXCLUDED.keyholder,
                 shift_pattern = EXCLUDED.shift_pattern,
                 notes = EXCLUDED.notes`,
            [id, data.designation, data.emergency_contact, data.joining_date, data.keyholder, data.shift_pattern, data.notes]
        );

        user = await findUser(id, client);

        const changed = Object.fromEntries(
            ["full_name", "email", "role", "phone", "designation",
             "emergency_contact", "joining_date", "keyholder", "shift_pattern", "notes"]
                .filter((key) => String(before[key] ?? "") !== String(user[key] ?? ""))
                .map((key) => [key, { from: before[key], to: user[key] }])
        );

        await logAudit({
            actorId: req.user.id,
            action: "user.updated",
            entityType: "user",
            entityId: id,
            details: { changed, password_reset: Boolean(passwordHash) }
        }, client);

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "23505") {
            return res.status(409).json({ success: false, message: "Email already exists" });
        }
        throw err;
    } finally {
        client.release();
    }

    if (passwordHash) {
        await notify({
            userId: id,
            title: "Your password was reset",
            message: `${req.user.full_name} set a new password for your account.`,
            type: "account"
        });
    }

    res.json({
        success: true,
        message: "User updated successfully",
        user
    });
};

// PATCH /api/users/:id/approve  (chairman)
// Also works on a previously rejected registration (change of mind).
export const approveUser = async (req, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(
        `UPDATE users
         SET approval_status = 'approved', is_active = TRUE,
             reviewed_by = $2, reviewed_at = NOW(), rejection_reason = NULL
         WHERE id = $1 AND approval_status IN ('pending', 'rejected')
         RETURNING id`,
        [id, req.user.id]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({
            success: false,
            message: "No registration waiting for approval with that id"
        });
    }

    const user = await findUser(id);

    await logAudit({
        actorId: req.user.id,
        action: "user.approved",
        entityType: "user",
        entityId: id,
        details: { role: user.role, designation: user.designation }
    });

    await notify({
        userId: id,
        title: `Welcome, ${user.full_name}`,
        message: `${req.user.full_name} approved your registration.`,
        type: "account"
    });

    await sendEmail({ to: user.email, ...emails.registrationApproved(user) });

    res.json({
        success: true,
        message: `${user.full_name} is approved and can now sign in`,
        user
    });
};

// PATCH /api/users/:id/reject  (chairman)  body: { reason }
export const rejectUser = async (req, res) => {
    const id = parseId(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!reason || reason.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Please give a reason (up to 500 characters)"
        });
    }

    const result = await pool.query(
        `UPDATE users
         SET approval_status = 'rejected', reviewed_by = $2,
             reviewed_at = NOW(), rejection_reason = $3
         WHERE id = $1 AND approval_status = 'pending'
         RETURNING id`,
        [id, req.user.id, reason]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({
            success: false,
            message: "No registration waiting for approval with that id"
        });
    }

    const user = await findUser(id);

    await logAudit({
        actorId: req.user.id,
        action: "user.rejected",
        entityType: "user",
        entityId: id,
        details: { reason }
    });

    await sendEmail({ to: user.email, ...emails.registrationRejected(user, reason) });

    res.json({
        success: true,
        message: `${user.full_name}'s registration was rejected`,
        user
    });
};

// PATCH /api/users/:id/deactivate and /activate  (chairman)
const setActive = (isActive) => async (req, res) => {
    const id = parseId(req.params.id);

    if (id === req.user.id) {
        return res.status(400).json({
            success: false,
            message: "You cannot change your own account status"
        });
    }

    const result = await pool.query(
        `UPDATE users SET is_active = $1
         WHERE id = $2 AND role <> 'chairman' AND approval_status = 'approved'
         RETURNING id`,
        [isActive, id]
    );

    if (result.rowCount === 0) return notFound(res);

    await logAudit({
        actorId: req.user.id,
        action: isActive ? "user.activated" : "user.deactivated",
        entityType: "user",
        entityId: id
    });

    res.json({
        success: true,
        message: isActive ? "User reactivated" : "User deactivated",
        user: await findUser(id)
    });
};

export const deactivateUser = setActive(false);
export const activateUser = setActive(true);

// DELETE /api/users/:id  (chairman). P2 "Remove person": switches off sign-in and
// hides them from People. Their history stays, so the records still make sense.
export const removeUser = async (req, res) => {
    const id = parseId(req.params.id);

    if (id === req.user.id) {
        return res.status(400).json({ success: false, message: "You cannot remove yourself" });
    }

    const result = await pool.query(
        `UPDATE users SET is_active = false, removed_at = now()
         WHERE id = $1 AND role <> 'chairman' AND removed_at IS NULL
         RETURNING full_name`,
        [id]
    );
    if (result.rowCount === 0) return notFound(res);

    const open = await pool.query(
        "SELECT count(*)::int AS n FROM tasks WHERE assigned_to = $1 AND status IN ('todo', 'flagged')",
        [id]
    );

    await logAudit({
        actorId: req.user.id,
        action: "user.removed",
        entityType: "user",
        entityId: id,
        details: { name: result.rows[0].full_name, open_tasks: open.rows[0].n }
    });

    const n = open.rows[0].n;
    res.json({
        success: true,
        open_tasks: n,
        message: `${result.rows[0].full_name} removed${n ? `. ${n} open task${n === 1 ? "" : "s"} still assigned to them need someone new` : ""}`
    });
};

// PUT /api/users/:id/access  (chairman)  P2 "What Meena can see and do"
export const updateAccess = async (req, res) => {
    const id = parseId(req.params.id);
    const { data, error } = validateAccess(req.body ?? {});
    if (error) return res.status(400).json({ success: false, message: error });
    const target = (await pool.query("SELECT role, full_name FROM users WHERE id = $1 AND removed_at IS NULL", [id])).rows[0];
    if (!target) return notFound(res);
    if (target.role !== "committee") return res.status(400).json({ success: false, message: "Access per area is for committee members" });
    await pool.query("UPDATE users SET access = $1 WHERE id = $2", [JSON.stringify(data), id]);
    await logAudit({ actorId: req.user.id, action: "user.access_changed", entityType: "user", entityId: id, details: data });
    res.json({ success: true, message: `${target.full_name}'s access saved`, access: effectiveAccess({ role: "committee", access: data }) });
};
