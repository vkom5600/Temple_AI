import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const { Pool, types } = pg;

// Return DATE columns as plain "YYYY-MM-DD" text. By default pg turns them into
// a JS Date at midnight in the *server's* time zone, which can shift the day.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.on("error", (error) => {
    console.error("Unexpected database error:", error);
});

export default pool;