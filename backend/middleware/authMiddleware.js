import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const result = await pool.query(
            `SELECT id, full_name, email, role, is_active
             FROM users
             WHERE id = $1`,
            [decoded.id]
        );

        if (result.rows.length === 0 ||
            !result.rows[0].is_active) {
            return res.status(401).json({
                success: false,
                message: "User account is inactive or unavailable"
            });
        }

        req.user = result.rows[0];
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token"
        });
    }
};

// Role-based authorization
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
