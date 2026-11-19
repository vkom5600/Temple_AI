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
    { full_name: "Anita",  email: "anita@temple.demo",  role: "volunteer", phone: "+44 7700 900013", approval_status: "pending", signup_details: { availability: ["weekends", "festivals"], help: ["kitchen", "parking"] } },
    { full_name: "Mohan",  email: "mohan@temple.demo",  role: "staff", designation: "cook", phone: "+44 7700 900014", approval_status: "pending", signup_details: { availability: ["weekday_mornings"], help: [] } }
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
            `INSERT INTO users (full_name, email, password_hash, role, phone, approval_status, signup_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (email) DO NOTHING
             RETURNING id`,
            [person.full_name, person.email, passwordHash, person.role, person.phone,
             person.approval_status ?? "approved",
             person.signup_details ? JSON.stringify({ ...person.signup_details, rules_agreed_at: new Date().toISOString() }) : null]
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
    // [title, category, area, group or email, minutes from now (null = no deadline), extras]
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
    ["Reply to member about stall request", "Admin & committee", "Community Hall", "raghu@temple.demo", -26 * 60, {}],
    // No deadline ("any time"), as in designs M2 and T2
    ["Polish the brass lamps", "Puja & rituals", "Main Mandir", "priest", null, {}],
    ["Repaint side gate", "Maintenance", "Whole compound", "harish@temple.demo", null, {}]
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

// Today: priest, cook, cleaner and security are in (matches the prototype);
// caretaker, maintenance and volunteers are not, so Who's On shows gaps.
// Yesterday: a full day, with Dev locking up and confirming the closing checks.
export async function seedDemoAttendance(pool) {
    const existing = await pool.query("SELECT 1 FROM attendance LIMIT 1");
    if (existing.rowCount) {
        console.log("Attendance already exists, demo attendance skipped.");
        return;
    }

    const tz = process.env.TEMPLE_TIMEZONE || "Europe/London";
    const ids = Object.fromEntries(
        (await pool.query("SELECT id, email FROM users")).rows.map((u) => [u.email.split("@")[0], u.id])
    );

    // Arrived N minutes ago, but never before 00:01 today (temple time).
    for (const [name, minutesAgo] of [["anil", 255], ["kamla", 200], ["ramesh", 150], ["dev", 90]]) {
        await pool.query(
            `INSERT INTO attendance (user_id, attendance_date, status, check_in, updated_by)
             VALUES ($1, (NOW() AT TIME ZONE $2)::date, 'present',
                     GREATEST(NOW() - make_interval(mins => $3),
                              ((NOW() AT TIME ZONE $2)::date::timestamp AT TIME ZONE $2) + INTERVAL '1 minute'),
                     $1)`,
            [ids[name], tz, minutesAgo]
        );
    }

    // Yesterday, local times
    const yesterday = [
        ["anil", "06:30", "13:00"], ["kamla", "08:00", "19:30"], ["ramesh", "07:00", "15:00"],
        ["jaya", "09:00", "17:00"], ["harish", "10:00", "14:00"], ["priya", "17:00", "20:00"],
        ["dev", "12:00", "21:10"]
    ];
    for (const [name, inAt, outAt] of yesterday) {
        const last = name === "dev";
        await pool.query(
            `INSERT INTO attendance (user_id, attendance_date, status, check_in, check_out,
                                     closing_checks, closing_confirmed_at, updated_by)
             VALUES ($1, (NOW() AT TIME ZONE $2)::date - 1, 'present',
                     ((((NOW() AT TIME ZONE $2)::date - 1) + $3::time) AT TIME ZONE $2),
                     ((((NOW() AT TIME ZONE $2)::date - 1) + $4::time) AT TIME ZONE $2),
                     $5, CASE WHEN $6 THEN ((((NOW() AT TIME ZONE $2)::date - 1) + $4::time) AT TIME ZONE $2) END,
                     $1)`,
            [ids[name], tz, inAt, outAt, last ? JSON.stringify({ lamps: true, gas: true, doors: true }) : null, last]
        );
    }
    await pool.query(
        `INSERT INTO attendance (user_id, attendance_date, status, notes, updated_by)
         VALUES ($1, (NOW() AT TIME ZONE $2)::date - 1, 'absent', 'Unwell', $3)`,
        [ids.vikram, tz, ids.raghu]
    );

    console.log("Seeded demo attendance for today and yesterday.");
}

// Phase 3: a few demo bookings (two confirmed today, two requests waiting).
export async function seedDemoBookings(pool) {
    const existing = await pool.query("SELECT 1 FROM bookings LIMIT 1");
    if (existing.rowCount) {
        console.log("Bookings already exist, demo bookings skipped.");
        return;
    }
    const tz = process.env.TEMPLE_TIMEZONE || "Europe/London";
    const space = async (name) => (await pool.query("SELECT id FROM resources WHERE name = $1", [name])).rows[0]?.id;
    const person = async (email) => (await pool.query("SELECT id FROM users WHERE email = $1", [email])).rows[0]?.id;
    const rules = (await pool.query("SELECT id FROM temple_rules WHERE ask_requester AND is_active")).rows.map((r) => r.id);

    // [title, space, days from today, start hour, end hour, guests, source, status, requester, all rules agreed]
    const demo = [
        ["Yoga class", "Community Hall", 0, 9, 10.5, 20, "desk", "approved", "meena@temple.demo", false],
        ["Bhajan group", "Room G37", 0, 18, 19.5, 15, "desk", "approved", "meena@temple.demo", false],
        ["Birthday puja", "Shivaji Hall", 3, 14, 18, 80, "mobile", "pending", "ramesh@temple.demo", true],
        ["Diwali sweets stall", "Community Hall", 5, 17, 23, 40, "mobile", "pending", "priya@temple.demo", true]
    ];
    for (const [title, name, days, from, to, guests, source, status, email, agreed] of demo) {
        await pool.query(
            `INSERT INTO bookings (resource_id, title, starts_at, ends_at, guests, food, contact_name, contact_phone,
                                   status, source, requested_by, rules_agreed, rules_agreed_at, reviewed_by, reviewed_at)
             SELECT $1, $2,
                    ((date_trunc('day', NOW() AT TIME ZONE $13) + make_interval(days => $3) + make_interval(mins => $4)) AT TIME ZONE $13),
                    ((date_trunc('day', NOW() AT TIME ZONE $13) + make_interval(days => $3) + make_interval(mins => $5)) AT TIME ZONE $13),
                    $6, $7, u.full_name, u.phone, $8::varchar, $9, u.id, $10, $11::timestamptz,
                    CASE WHEN $8::varchar = 'approved' THEN u.id END, CASE WHEN $8::varchar = 'approved' THEN NOW() END
             FROM users u WHERE u.id = $12`,
            [await space(name), title, days, Math.round(from * 60), Math.round(to * 60), guests, title.includes("puja"),
             status, source, JSON.stringify(agreed ? rules : []), agreed ? new Date() : null, await person(email), tz]
        );
    }
    console.log(`Seeded ${demo.length} demo bookings.`);
}

// Last year's Diwali celebration, with its jobs done, so Plan with AI can show
// "plan from last year" (AI2, screens/09) in the demo.
export async function seedLastYearEvent(pool) {
    const already = await pool.query("SELECT 1 FROM bookings WHERE title = 'Diwali celebration' AND starts_at < NOW()");
    if (already.rowCount) return;
    const tz = process.env.TEMPLE_TIMEZONE || "Europe/London";
    const hall = (await pool.query("SELECT id FROM resources WHERE name = 'Shivaji Hall'")).rows[0]?.id;
    const chairman = (await pool.query("SELECT id, full_name FROM users WHERE role = 'chairman' ORDER BY id LIMIT 1")).rows[0];
    const doer = async (email) => (await pool.query("SELECT id FROM users WHERE email = $1", [email])).rows[0]?.id ?? null;
    if (!hall || !chairman) return;

    const event = await pool.query(
        `INSERT INTO bookings (resource_id, kind, title, starts_at, ends_at, guests, contact_name, status, source,
                               requested_by, rules_agreed, reviewed_by, reviewed_at)
         VALUES ($1, 'event', 'Diwali celebration',
                 ((date_trunc('day', NOW() AT TIME ZONE $2) - interval '363 days' + interval '18 hours') AT TIME ZONE $2),
                 ((date_trunc('day', NOW() AT TIME ZONE $2) - interval '363 days' + interval '22 hours') AT TIME ZONE $2),
                 200, $3, 'approved', 'desk', $4, '[]', $4, NOW() - interval '370 days')
         RETURNING id, starts_at, ends_at`,
        [hall, tz, chairman.full_name, chairman.id]
    );
    const { id, starts_at: start, ends_at: end } = event.rows[0];
    const at = (base, minutes) => new Date(new Date(base).getTime() + minutes * 60_000);
    // [title, group, due, category, safety, done by]
    const jobs = [
        ["Tell devotees about the Diwali celebration", "committee", at(start, -7 * 24 * 60), "Admin & committee", false, "meena@temple.demo"],
        ["Decorate Shivaji Hall (rangoli, diyas, flowers)", "volunteer", at(start, -180), "Events & bookings", false, "priya@temple.demo"],
        ["Prepare prasad for 200 people", "cook", at(start, -120), "Kitchen", false, "kamla@temple.demo"],
        ["Clean and prepare Shivaji Hall", "cleaner", at(start, -60), "Cleaning", false, "ramesh@temple.demo"],
        ["Lakshmi puja and aarti", "priest", at(start, 30), "Puja & rituals", false, "anil@temple.demo"],
        ["Fireworks safety perimeter", "security", at(start, 150), "Security & closing", true, "dev@temple.demo"],
        ["Clean-up and recycling", "volunteer", at(end, 30), "Cleaning", false, "vikram@temple.demo"],
        ["Check Shivaji Hall and lock up", "security", at(end, 15), "Security & closing", true, "dev@temple.demo"]
    ];
    for (const [title, group, due, category, safety, email] of jobs) {
        const by = await doer(email);
        await pool.query(
            `INSERT INTO tasks (title, category, area, assigned_group, priority, requires_verification, due_at, recurrence,
                                created_by, status, completed_by, completed_at, verified_by, verified_at, booking_id)
             VALUES ($1, $2, 'Shivaji Hall', $3, 'normal', $4, $5, 'none', $6, 'done', $7, $5, $8, $9, $10)`,
            [title, category, group, safety, due, chairman.id, by, safety ? chairman.id : null, safety ? due : null, id]
        );
    }
    console.log("Seeded last year's Diwali celebration (for Plan with AI).");
}

// A few festivals so Home and the Calendar have something to show. These dates are
// NOT confirmed (confirmed = false shows "date to confirm"): the priest or committee
// should check and correct them in Calendar → Festivals.
export async function seedFestivals(pool) {
    const any = await pool.query("SELECT 1 FROM festivals LIMIT 1");
    if (any.rowCount) return;
    const list = [
        ["Diwali", "Festival of Lights", "2026-11-08", "festival", "07:00", "22:30"],
        ["Makar Sankranti", null, "2027-01-14", "festival", null, null],
        ["Maha Shivaratri", null, "2027-03-06", "festival", "07:00", "23:00"],
        ["Holi", "Festival of Colours", "2027-03-22", "festival", null, null],
        ["Ram Navami", null, "2027-04-15", "festival", null, null],
        ["Diwali", "Festival of Lights", "2027-10-29", "festival", "07:00", "22:30"]
    ];
    for (const [name, subtitle, date, kind, opens, closes] of list) {
        await pool.query(
            `INSERT INTO festivals (name, subtitle, festival_date, kind, opens, closes, confirmed) VALUES ($1,$2,$3,$4,$5,$6,false)`,
            [name, subtitle, date, kind, opens, closes]);
    }
    console.log(`Seeded ${list.length} festivals (dates to confirm).`);
}

// P2 extras for one demo person, as in the design (Ramesh, cleaner).
export async function seedPersonExtras(pool) {
    await pool.query(
        `UPDATE staff_profiles sp SET keyholder = 'Main Mandir, Stores G12', shift_pattern = 'Mon–Fri · 08:00–16:00',
                notes = 'Trained on the floor scrubber. Key holder for the supply store.'
         FROM users u WHERE u.id = sp.user_id AND u.email = 'ramesh@temple.demo' AND sp.keyholder IS NULL`);
}
