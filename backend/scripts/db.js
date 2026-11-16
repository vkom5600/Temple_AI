// Database helper.
//   npm run db:migrate   apply any new files in database/migrations (in name order)
//   npm run db:seed      add the demo accounts (development only)
//   npm run db:reset     wipe the database, migrate, then seed (development only)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";
import { seedDemoData } from "./seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "database", "migrations");

const assertNotProduction = (command) => {
    if (process.env.NODE_ENV === "production") {
        throw new Error(`"${command}" is disabled when NODE_ENV=production`);
    }
};

async function migrate() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            name        VARCHAR(200) PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );

    const applied = new Set(
        (await pool.query("SELECT name FROM schema_migrations")).rows
            .map((row) => row.name)
    );

    const files = (await fs.readdir(migrationsDir))
        .filter((file) => file.endsWith(".sql"))
        .sort();

    let count = 0;

    for (const file of files) {
        if (applied.has(file)) continue;

        const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query(
                "INSERT INTO schema_migrations (name) VALUES ($1)",
                [file]
            );
            await client.query("COMMIT");
            console.log(`Applied ${file}`);
            count += 1;
        } catch (error) {
            await client.query("ROLLBACK");
            throw new Error(`Migration ${file} failed: ${error.message}`);
        } finally {
            client.release();
        }
    }

    console.log(count ? `${count} migration(s) applied.` : "Database is up to date.");
}

async function reset() {
    assertNotProduction("db:reset");
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("Database wiped.");
    await migrate();
    await seedDemoData(pool);
}

const commands = {
    migrate,
    reset,
    seed: async () => {
        assertNotProduction("db:seed");
        await seedDemoData(pool);
    }
};

const command = process.argv[2];

if (!commands[command]) {
    console.error(`Usage: node scripts/db.js <${Object.keys(commands).join("|")}>`);
    process.exit(1);
}

try {
    await commands[command]();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
