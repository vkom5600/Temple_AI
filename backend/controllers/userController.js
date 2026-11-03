import bcrypt from "bcryptjs";
import pool from "../config/db.js";

// CREATE USER
export const createUser = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        const allowedRoles = [
            "committee",
            "staff",
            "volunteer"
        ];

        if (!full_name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must be 8 to 72 characters"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
             (full_name, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, full_name, email, role, is_active`,
            [
                full_name.trim(),
                email.trim().toLowerCase(),
                passwordHash,
                role
            ]
        );

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        console.error("Create user error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to create user"
        });
    }
};

// GET ALL USERS
export const getUsers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, role,
                    is_active, created_at
             FROM users
             ORDER BY id DESC`
        );

        res.json({
            success: true,
            count: result.rows.length,
            users: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to fetch users"
        });
    }
};

// UPDATE USER
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, role } = req.body;

        const allowedRoles = [
            "chairman",
            "committee",
            "staff",
            "volunteer"
        ];

        if (!full_name || !email || !role ||
            !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Provide valid name, email and role"
            });
        }

        // Prevent changing the only Chairman's role
        if (Number(id) === req.user.id &&
            req.user.role === "chairman" &&
            role !== "chairman") {
            return res.status(403).json({
                success: false,
                message: "You cannot remove your own Chairman role"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET full_name = $1, email = $2, role = $3
             WHERE id = $4
             RETURNING id, full_name, email, role, is_active`,
            [
                full_name.trim(),
                email.trim().toLowerCase(),
                role,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "User updated successfully",
            user: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to update user"
        });
    }
};

// DEACTIVATE USER
export const deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (Number(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot deactivate your own account"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET is_active = FALSE
             WHERE id = $1
             RETURNING id, full_name, email, role, is_active`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "User deactivated successfully",
            user: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to deactivate user"
        });
    }
};