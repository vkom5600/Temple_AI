// Demo accounts for local development: at least one person per role.
// Everyone shares DEMO_PASSWORD (from .env). Safe to run more than once.
import bcrypt from "bcryptjs";

const DEMO_USERS = [
    { full_name: "Raghu",  email: "raghu@temple.demo",  role: "chairman",  phone: "+44 7700 900001" },
    { full_name: "Meena",  email: "meena@temple.demo",  role: "committee", phone: "+44 7700 900021" },
    { full_name: "Suresh", email: "suresh@temple.demo", role: "committee", phone: "+44 7700 900002" },
    { full_name: "Anil",   email: "anil@temple.demo",   role: "staff", designation: "priest",      phone: "+44 7700 900004" },
    { full_name: "Kamla",  email: "kamla@temple.demo",  role: "staff", designation: "cook",        phone: "+44 7700 900006" },
    { full_name: "Ramesh", email: "ramesh@temple.demo", role: "staff", designation: "cleaner",     phone: "+44 7700 900007" },
    { full_name: "Jaya",   email: "jaya@temple.demo",   role: "staff", designation: "caretaker",   phone: "+44 7700 900008" },
    { full_name: "Dev",    email: "dev@temple.demo",    role: "staff", designation: "security",    phone: "+44 7700 900009" },
    { full_name: "Harish", email: "harish@temple.demo", role: "staff", designation: "maintenance", phone: "+44 7700 900010" },
    { full_name: "Priya",  email: "priya@temple.demo",  role: "volunteer", phone: "+44 7700 900011" },
    { full_name: "Vikram", email: "vikram@temple.demo", role: "volunteer", phone: "+44 7700 900012" },
    // Self-registered, waiting for the chairman (shows the approval queue)
    { full_name: "Anita",  email: "anita@temple.demo",  role: "volunteer", phone: "+44 7700 900013", approval_status: "pending" },
    { full_name: "Mohan",  email: "mohan@temple.demo",  role: "staff", designation: "cook", phone: "+44 7700 900014", approval_status: "pending" }
];

export async function seedDemoData(pool) {
    const password = process.env.DEMO_PASSWORD;

    if (!password || password.length < 8) {
        throw new Error("Set DEMO_PASSWORD (8+ characters) in backend/.env before seeding");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let created = 0;

    for (const person of DEMO_USERS) {
        const result = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone, approval_status)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO NOTHING
             RETURNING id`,
            [person.full_name, person.email, passwordHash, person.role, person.phone,
             person.approval_status ?? "approved"]
        );

        if (result.rowCount === 0) continue;

        await pool.query(
            `INSERT INTO staff_profiles (user_id, designation) VALUES ($1, $2)`,
            [result.rows[0].id, person.designation ?? null]
        );

        created += 1;
    }

    console.log(`Seeded ${created} demo account(s). Password for all: DEMO_PASSWORD from .env`);
}

// A realistic day of tasks (from the prototype), timed relative to now so there's
// always a mix of done, upcoming, overdue, waiting for sign-off and couldn't-do.
// Only runs when the tasks table is empty.
const DEMO_TASKS = [
    // [title, category, area, group or email, minutes from now, extras]
    ["Open the temple and light the lamps", "Puja & rituals", "Main Mandir", "priest", -240, { done: "anil", repeat: "daily" }],
    ["Morning puja and aarti", "Puja & rituals", "Main Mandir", "priest", -180, { done: "anil", repeat: "daily" }],
    ["Prepare items for evening aarti", "Puja & rituals", "Main Mandir", "priest", 90, { repeat: "daily" }],
    ["Closing: lamps off and all doors locked", "Security & closing", "Main Mandir", "priest", 360, { safety: true, priority: "high", repeat: "daily" }],
    ["Prepare prasad for evening", "Kitchen", "Kitchen", "cook", -45, {}],
    ["Kitchen closing: gas off, stove off, electrics off", "Kitchen", "Kitchen", "cook", 300, { safety: true, priority: "high", repeat: "daily" }],
    ["Clean the main mandir floor", "Cleaning", "Main Mandir", "cleaner", -120, { done: "ramesh", repeat: "daily" }],
    ["Clean Shivaji Hall after morning class", "Cleaning", "Shivaji Hall", "cleaner", -30, {}],
    ["Empty all bins", "Cleaning", "Whole compound", "cleaner", 120, { repeat: "daily" }],
    ["Check all doors and gates", "Security & closing", "Whole compound", "security", -60, { flagged: ["dev", "Something is broken", "Side door lock is broken, could not lock it."] }],
    ["Lock Community Hall after yoga class", "Security & closing", "Community Hall", "dev@temple.demo", -25, { safety: true, awaiting: "dev" }],
    ["Evening security round", "Security & closing", "Whole compound", "security", 240, { safety: true, repeat: "daily" }],
    ["Fix the leaking tap in the kitchen", "Maintenance", "Kitchen", "harish@temple.demo", -2 * 24 * 60, { priority: "high" }],
    ["Restock puja supplies (ghee, camphor, flowers)", "General", "Main Mandir", "caretaker", 60, {}],
    ["Welcome visitors at evening aarti", "General", "Main Mandir", "volunteer", 150, { repeat: "daily" }],
    ["Reply to member about stall request", "Admin & committee", "Community Hall", "raghu@temple.demo", -26 * 60, {}]
];

export async function seedDemoTasks(pool) {
    const existing = await pool.query("SELECT 1 FROM tasks LIMIT 1");
    if (existing.rowCount) {
        console.log("Tasks already exist, demo tasks skipped.");
        return;
    }

    const ids = Object.fromEntries(
        (await pool.query("SELECT id, email FROM users")).rows.map((u) => [u.email, u.id])
    );
    const who = (name) => ids[`${name}@temple.demo`];
    const chairman = who("raghu");

    for (const [title, category, area, assignee, minutes, extra] of DEMO_TASKS) {
        const toPerson = assignee.includes("@");
        const status = extra.done ? "done" : extra.awaiting ? "awaiting_signoff" : extra.flagged ? "flagged" : "todo";
        const completer = extra.done ? who(extra.done) : extra.awaiting ? who(extra.awaiting) : null;

        const result = await pool.query(
            `INSERT INTO tasks
                (title, category, area, assigned_to, assigned_group, priority,
                 requires_verification, status, due_at, recurrence,
                 completed_by, completed_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                     NOW() + make_interval(mins => $9), $10,
                     $11, CASE WHEN $11::int IS NULL THEN NULL ELSE NOW() + make_interval(mins => $9 + 5) END,
                     $12)
             RETURNING id`,
            [title, category, area,
             toPerson ? ids[assignee] : null, toPerson ? null : assignee,
             extra.priority ?? "normal", Boolean(extra.safety), status, minutes,
             extra.repeat ?? "none", completer, chairman]
        );
        const taskId = result.rows[0].id;

        if (extra.repeat) {
            await pool.query("UPDATE tasks SET series_id = id WHERE id = $1", [taskId]);
        }

        if (extra.flagged) {
            const [by, category, text] = extra.flagged;
            await pool.query(
                `INSERT INTO task_comments (task_id, user_id, comment, comment_type)
                 VALUES ($1, $2, $3, 'flagged')`,
                [taskId, who(by), text]
            );
            await pool.query(
                `INSERT INTO issues (reported_by, task_id, category, description, created_at)
                 VALUES ($1, $2, $3, $4, NOW() - INTERVAL '55 minutes')`,
                [who(by), taskId, category, text]
            );
        }
    }

    await pool.query(
        `INSERT INTO issues (reported_by, category, description, created_at)
         VALUES ($1, 'Supplies missing', 'Running low on ghee for the lamps. Maybe 2 days left.',
                 NOW() - INTERVAL '150 minutes')`,
        [who("anil")]
    );

    console.log(`Seeded ${DEMO_TASKS.length} demo tasks and 2 issues.`);
}
