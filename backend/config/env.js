// Loads .env and stops the server early if something essential is missing.
// Imported first in server.js.
import dotenv from "dotenv";

dotenv.config({ quiet: true });

// A hosted database (Neon, Supabase, Render) gives one DATABASE_URL instead of DB_* parts.
const required = process.env.DATABASE_URL ? ["JWT_SECRET"] : ["DB_HOST", "DB_NAME", "DB_USER", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(", ")}. See backend/.env.example`);
    process.exit(1);
}

if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith("YOUR_")) {
    console.error("JWT_SECRET must be a long random string (32+ characters). See backend/.env.example");
    process.exit(1);
}
