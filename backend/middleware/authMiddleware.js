import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const ROLES = ["chairman", "committee", "staff", "volunteer"];
export const ADMIN_ROLES = ["chairman", "committee"];

// Checks the Bearer token and loads the current user into req.user.
// The user is re-read from the database on every request so a
// deactivated account or changed role takes effect immediately.
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required"
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token"
        });
    }

    const result = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.is_active, u.approval_status,
                sp.designation
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.id = $1`,
        [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active ||
        result.rows[0].approval_status !== "approved") {
        return res.status(401).json({
            success: false,
            message: "User account is inactive or unavailable"
        });
    }

    req.user = result.rows[0];
    next();
};

// Role-based access: router.post("/", authorizeRoles("chairman"), handler)
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource"
            });
        }

        next();
    };
};
