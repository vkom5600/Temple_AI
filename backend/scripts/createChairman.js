import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

dotenv.config();

async function createChairman() {
    try {
        const name = process.env.INITIAL_CHAIRMAN_NAME;
        const email = process.env.INITIAL_CHAIRMAN_EMAIL;
        const password = process.env.INITIAL_CHAIRMAN_PASSWORD;

        if (!name || !email || !password || password.length < 12) {
            throw new Error(
                "Set Chairman name, email and a password of at least 12 characters in .env"
            );
        }

        const existing = await pool.query(
            "SELECT id FROM users WHERE role = 'chairman'"
        );

        if (existing.rows.length > 0) {
            console.log("A Chairman account already exists.");
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            `INSERT INTO users
            (full_name, email, password_hash, role)
            VALUES ($1, $2, $3, 'chairman')`,
            [name, email.toLowerCase(), passwordHash]
        );

        console.log("Chairman account created successfully.");
        console.log("Email:", email);

    } catch (error) {
        console.error("Chairman setup failed:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

createChairman();