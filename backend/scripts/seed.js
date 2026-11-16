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
