import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const { Pool, types } = pg;

// Return DATE columns as plain "YYYY-MM-DD" text. By default pg turns them into
// a JS Date at midnight in the *server's* time zone, which can shift the day.
types.setTypeParser(types.builtins.DATE, (value) => value);

// Local: DB_HOST / DB_NAME / DB_USER / DB_PASSWORD.
// Hosted (Neon, Supabase, Render): DATABASE_URL, usually with DB_SSL=true.
const ssl = process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined;
const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl }
        : {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 5432),
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl,
        }
);

pool.on("error", (error) => {
    console.error("Unexpected database error:", error);
});

export default pool;