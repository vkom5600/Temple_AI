import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { sendEmail, chairmanEmails } from "../services/emailService.js";
import { getSetting, getSignupWindow } from "../services/settingsService.js";
import * as emails from "../services/emailTemplates.js";
import { validateUserBody } from "../utils/userValidation.js";
import { effectiveAccess } from "../middleware/access.js";

// Compared against when the email is unknown, so a wrong email and a
// wrong password take the same time (doesn't reveal which emails exist).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const publicUser = (row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    designation: row.designation,
    access: effectiveAccess(row) // committee per-area access (null for staff and volunteers)
});

// Login / email work that shouldn't slow down the response.
const inBackground = (task) => {
    task().catch((error) => console.error("Background task failed:", error.message));
};

// GET /api/auth/registration-status  (public)
export const registrationStatus = async (req, res) => {
    const w = await getSignupWindow();
    res.json({ success: true, open: w.open, roles: w.open ? w.roles : [], next_opens: w.next_opens, closes: w.open ? w.closes : null });
};

// POST /api/auth/register  (public)
// Creates a pending account; the chairman approves or rejects it.
export const register = async (req, res) => {
    const signupWindow = await getSignupWindow();
    if (!signupWindow.open) {
        return res.status(403).json({
            success: false,
            message: "Registration is closed at the moment. Please contact the temple office."
        });
    }
    if (!signupWindow.roles.includes(req.body?.role)) {
        return res.status(403).json({
            success: false,
            message: "Sign-ups for that group aren't open right now. Please contact the temple office."
        });
    }

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
                (full_name, email, password_hash, role, phone, approval_status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING id, full_name, email, role, phone`,
            [data.full_name, data.email, passwordHash, data.role, data.phone]
        );
        user = { ...inserted.rows[0], designation: data.designation };

        await client.query(
            "INSERT INTO staff_profiles (user_id, designation) VALUES ($1, $2)",
            [user.id, data.designation]
        );

        await logAudit({
            actorId: user.id,
            action: "user.registered",
            entityType: "user",
            entityId: user.id,
            details: { role: data.role, designation: data.designation }
        }, client);

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This email is already registered. Try signing in instead."
            });
        }
        throw err;
    } finally {
        client.release();
    }

    await notify({
        roles: ["chairman"],
        title: "New registration",
        message: `${user.full_name} wants to join as ${user.role}${user.designation ? ` (${user.designation})` : ""}.`,
        type: "registration"
    });

    inBackground(async () => {
        await sendEmail({ to: user.email, ...emails.registrationReceived(user) });
        await sendEmail({ to: await chairmanEmails(), ...emails.newRegistrationAlert(user) });
    });

    res.status(201).json({
        success: true,
        message: "Thank you! Your registration is waiting for the chairman's approval. We'll email you when it's decided."
    });
};

// POST /api/auth/login
export const login = async (req, res) => {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string" ||
        !email.trim() || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const result = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.password_hash, u.role, u.phone,
                u.is_active, u.approval_status, u.rejection_reason, u.access, sp.designation
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.email = $1`,
        [email.trim().toLowerCase()]
    );

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(
        password,
        user?.password_hash ?? DUMMY_HASH
    );

    if (!user || !validPassword) {
        return res.status(401).json({
            success: false,
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password"
        });
    }

    // Account state is only revealed once the password is proven correct.
    if (user.approval_status === "pending") {
        return res.status(403).json({
            success: false,
            code: "ACCOUNT_PENDING",
            message: "Your registration is waiting for the chairman's approval. We'll email you when it's decided."
        });
    }

    if (user.approval_status === "rejected") {
        return res.status(403).json({
            success: false,
            code: "ACCOUNT_REJECTED",
            message: `Your registration was not approved${user.rejection_reason ? `: ${user.rejection_reason}` : "."}`
        });
    }

    if (!user.is_active) {
        return res.status(403).json({
            success: false,
            code: "ACCOUNT_INACTIVE",
            message: "Your account is inactive. Please contact the chairman."
        });
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );

    await logAudit({
        actorId: user.id,
        action: "user.logged_in",
        entityType: "user",
        entityId: user.id
    });

    // Login emails (from the login sequence diagram).
    inBackground(async () => {
        await sendEmail({ to: user.email, ...emails.loginNotice(user) });

        if (user.role !== "chairman" && await getSetting("login_alert_to_chairman", true)) {
            await sendEmail({ to: await chairmanEmails(), ...emails.loginAlertToChairman(user) });
        }
    });

    res.json({
        success: true,
        message: "Login successful",
        token,
        user: publicUser(user)
    });
};

// GET /api/auth/profile
export const getProfile = async (req, res) => {
    res.json({
        success: true,
        user: publicUser(req.user)
    });
};
