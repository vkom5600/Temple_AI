// Automated API tests (Phase 5). Run with: npm test
//
// Uses its own database (DB_NAME + "_test"), wipes and seeds it with the demo data,
// starts the API on a spare port with the scheduled jobs off, and checks the main
// flows over HTTP: sign-in, permissions, tasks, attendance, bookings, people,
// committee access, festivals, plans and reports. Your normal database isn't touched.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

if (process.env.DATABASE_URL) throw new Error("Tests use a local test database. Unset DATABASE_URL to run them.");
const TEST_DB = `${process.env.DB_NAME}_test`;
const PORT = 5099;
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = process.env.DEMO_PASSWORD || "Temple@1234";
const env = { ...process.env, DB_NAME: TEST_DB, PORT: String(PORT), DISABLE_JOBS: "1", ANTHROPIC_API_KEY: "", NODE_ENV: "test" };

let server;
const tokens = {};

const call = async (method, url, who, body) => {
    const r = await fetch(BASE + url, {
        method,
        headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
};
const get = (url, who) => call("GET", url, who);
const post = (url, who, body = {}) => call("POST", url, who, body);
const put = (url, who, body = {}) => call("PUT", url, who, body);
const patch = (url, who, body = {}) => call("PATCH", url, who, body);
const del = (url, who) => call("DELETE", url, who);

const inDays = (n, hour = 11) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };

before(async () => {
    // A fresh test database with the demo data
    const admin = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: "postgres" });
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
    if (!exists.rowCount) await admin.query(`CREATE DATABASE "${TEST_DB.replace(/"/g, "")}"`);
    await admin.end();
    execFileSync("node", ["scripts/db.js", "reset"], { cwd: root, env, stdio: "ignore" });

    server = spawn("node", ["server.js"], { cwd: root, env, stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* starting */ }
        await new Promise((r) => setTimeout(r, 200));
    }
    for (const who of ["raghu", "meena", "anil", "priya", "dev", "ramesh"]) {
        const r = await post("/auth/login", null, { email: `${who}@temple.demo`, password: PASSWORD });
        assert.equal(r.status, 200, `sign in as ${who}`);
        tokens[who] = r.body.token;
    }
});

after(() => server?.kill());

describe("sign-in", () => {
    test("wrong password is refused", async () => {
        const r = await post("/auth/login", null, { email: "raghu@temple.demo", password: "not-the-password" });
        assert.equal(r.status, 401);
    });
    test("no token, no data", async () => {
        assert.equal((await get("/tasks", null)).status, 401);
    });
    test("profile carries committee access", async () => {
        const r = await get("/auth/profile", "meena");
        assert.equal(r.body.user.role, "committee");
        assert.equal(r.body.user.access.tasks, "manage");
        assert.equal((await get("/auth/profile", "anil")).body.user.access, null);
    });
});

describe("permissions", () => {
    test("staff can't use admin areas", async () => {
        assert.equal((await get("/users", "anil")).status, 403);
        assert.equal((await post("/tasks", "anil", { title: "x", assigned_group: "cook" })).status, 403);
        assert.equal((await post("/notifications/broadcast", "anil", { message: "hi", audience: "everyone" })).status, 403);
        assert.equal((await get("/settings", "meena")).status, 403, "settings are the chairman's");
    });
});

describe("tasks", () => {
    test("a safety task needs a second person to sign off", async () => {
        const created = await post("/tasks", "raghu", { title: "Test: lock the side door", assigned_group: "security", requires_verification: true, due_at: inDays(0, 23).toISOString(), category: "Security & closing" });
        assert.equal(created.status, 201);
        const id = created.body.tasks[0].id;
        assert.equal((await patch(`/tasks/${id}/complete`, "anil")).status, 403, "not the priest's task");
        const done = await patch(`/tasks/${id}/complete`, "dev");
        assert.equal(done.status, 200);
        assert.equal(done.body.task.status, "awaiting_signoff");
        assert.equal((await patch(`/tasks/${id}/verify`, "dev")).status >= 400, true, "can't sign off your own work");
        const ok = await patch(`/tasks/${id}/verify`, "priya");
        assert.equal(ok.status, 200);
        assert.equal(ok.body.task.status, "done");
    });
    test("repeating tasks need a time; one-off tasks don't", async () => {
        assert.equal((await post("/tasks", "raghu", { title: "Test: weekly", assigned_group: "cleaner", recurrence: "weekly", due_at: null })).status, 400);
        assert.equal((await post("/tasks", "raghu", { title: "Test: any time", assigned_group: "cleaner", due_at: null })).status, 201);
    });
    test("remind can't be sent twice in five minutes", async () => {
        const t = await post("/tasks", "raghu", { title: "Test: remind me", assigned_group: "cook", due_at: inDays(0, 23).toISOString() });
        const id = t.body.tasks[0].id;
        assert.equal((await post(`/tasks/${id}/remind`, "raghu")).status, 200);
        assert.equal((await post(`/tasks/${id}/remind`, "raghu")).status, 429);
    });
});

describe("attendance", () => {
    test("check in once, then leave", async () => {
        await post("/attendance/undo-check-in", "ramesh").catch(() => {});
        const first = await post("/attendance/check-in", "ramesh");
        assert.ok([200, 201, 409].includes(first.status));
        assert.equal((await post("/attendance/check-in", "ramesh")).status, 409, "already checked in");
    });
});

describe("bookings", () => {
    let rules, hall, request;
    test("a staff request needs every rule agreed", async () => {
        rules = (await get("/rules", "priya")).body.rules.filter((r) => r.ask_requester).map((r) => r.id);
        hall = (await get("/resources", "priya")).body.resources.find((r) => r.name === "Room G38");
        const base = { resource_id: hall.id, title: "Test: study group", starts_at: inDays(9, 10).toISOString(), ends_at: inDays(9, 12).toISOString(), guests: 10 };
        assert.equal((await post("/bookings", "priya", { ...base, rules_agreed: [] })).status, 400);
        request = await post("/bookings", "priya", { ...base, rules_agreed: rules });
        assert.equal(request.status, 201);
        assert.equal(request.body.booking.status, "pending");
    });
    test("declining needs a reason; approving adds prep tasks", async () => {
        const id = request.body.booking.id;
        assert.equal((await patch(`/bookings/${id}/decline`, "raghu", {})).status, 400);
        const ok = await patch(`/bookings/${id}/approve`, "meena", { create_tasks: true });
        assert.equal(ok.status, 200);
        const detail = await get(`/bookings/${id}`, "raghu");
        assert.ok(detail.body.tasks.length >= 2, "prep tasks created");
    });
    test("the same slot can't be booked twice", async () => {
        const clash = await post("/bookings", "raghu", { resource_id: hall.id, title: "Test: clash", starts_at: inDays(9, 11).toISOString(), ends_at: inDays(9, 13).toISOString() });
        assert.equal(clash.status, 409);
    });
});

describe("public booking form (W1)", () => {
    let opts;
    const slot = () => ({ starts_at: inDays(12, 14).toISOString(), ends_at: inDays(12, 16).toISOString() });
    test("anyone can see the halls and the rules, but not other people's bookings", async () => {
        opts = (await get("/public/booking-options", null)).body;
        assert.ok(opts.resources.length >= 2 && opts.rules.length >= 1);
        assert.ok(opts.resources.every((r) => ["hall", "room"].includes(r.kind)));
        const c = await post("/public/check", null, { resource_id: opts.resources[0].id, ...slot(), guests: 10 });
        assert.equal(c.status, 200);
        assert.equal(c.body.clashes, undefined, "no clash details for the public");
    });
    test("a request needs name, mobile and every rule; it arrives as pending", async () => {
        const base = { resource_id: opts.resources.find((r) => r.name === "Room G37")?.id ?? opts.resources[0].id, title: "Test: website request", ...slot(), guests: 10, contact_name: "Test Visitor", contact_phone: "+44 7700 900777" };
        assert.equal((await post("/public/bookings", null, { ...base, contact_phone: "" })).status, 400);
        assert.equal((await post("/public/bookings", null, { ...base, rules_agreed: [] })).status, 400);
        const ok = await post("/public/bookings", null, { ...base, rules_agreed: opts.rules.map((r) => r.id) });
        assert.equal(ok.status, 201);
        assert.match(ok.body.reference, /^IHC-\d{4}-\d{4}$/);
        const waiting = (await get("/bookings?status=pending", "raghu")).body.bookings.find((b) => b.title === "Test: website request");
        assert.ok(waiting, "shows for the committee");
        assert.equal(waiting.source, "web");
        assert.equal((await post("/public/bookings", null, { ...base, rules_agreed: opts.rules.map((r) => r.id), website: "spam" })).status, 400, "bot trap");
    });
});

describe("people", () => {
    test("committee can't change people by default; the chairman can, and can remove", async () => {
        const created = await post("/users", "raghu", { full_name: "Test Volunteer", email: `tv${Date.now()}@example.com`, role: "volunteer", password: "Testpass123" });
        assert.equal(created.status, 201);
        const id = created.body.user.id;
        assert.equal((await put(`/users/${id}`, "meena", { full_name: "x" })).status, 403);
        assert.equal((await del(`/users/${id}`, "meena")).status, 403);
        assert.equal((await del(`/users/${id}`, "raghu")).status, 200);
        assert.ok(!(await get("/users", "raghu")).body.users.some((u) => u.id === id), "removed people leave the list");
    });
    test("sign-up window: only open groups can register", async () => {
        assert.equal((await put("/settings/signup-window", "raghu", { open: true, roles: ["volunteer"], opens: null, closes: null })).status, 200);
        const staff = await post("/auth/register", null, { full_name: "Test Staff", email: `ts${Date.now()}@example.com`, password: "Testpass123", role: "staff", designation: "cook" });
        assert.equal(staff.status, 403);
        await put("/settings/signup-window", "raghu", { open: true, roles: ["volunteer", "staff"], opens: null, closes: null });
    });
    test("sign-up form: mobile and the Temple Rules are required; answers are saved", async () => {
        const base = { full_name: "Test Signup", email: `su${Date.now()}@example.com`, password: "Testpass123", role: "volunteer", designation: "" };
        assert.equal((await post("/auth/register", null, { ...base, phone: "", agree_rules: true })).status, 400, "mobile required");
        assert.equal((await post("/auth/register", null, { ...base, phone: "+44 7700 900999" })).status, 400, "rules required");
        const ok = await post("/auth/register", null, { ...base, phone: "+44 7700 900999", agree_rules: true, availability: ["weekends", "made_up"], help: ["kitchen"] });
        assert.equal(ok.status, 201);
        const saved = (await get("/users", "raghu")).body.users.find((u) => u.email === base.email);
        assert.deepEqual(saved.signup_details.availability, ["weekends"], "unknown choices dropped");
        assert.deepEqual(saved.signup_details.help, ["kitchen"]);
        assert.ok((await get("/auth/temple-rules", null)).body.rules.length > 0, "rules readable before signing up");
    });
});

describe("committee access per area", () => {
    let meenaId;
    before(async () => { meenaId = (await get("/users", "raghu")).body.users.find((u) => u.email.startsWith("meena")).id; });
    after(async () => { await put(`/users/${meenaId}/access`, "raghu", { tasks: "manage", calendar: "manage", people: "view", rules: "manage", reports: "view", broadcast: true, ai: true }); });

    test("only the chairman sets access", async () => {
        assert.equal((await put(`/users/${meenaId}/access`, "meena", {})).status, 403);
    });
    test("View, Off and the switches are enforced", async () => {
        assert.equal((await put(`/users/${meenaId}/access`, "raghu", { tasks: "view", calendar: "off", people: "view", rules: "view", reports: "off", broadcast: false, ai: false })).status, 200);
        assert.equal((await get("/tasks", "meena")).status, 200, "can view tasks");
        assert.equal((await post("/tasks", "meena", { title: "x", assigned_group: "cook" })).status, 403, "can't create");
        assert.equal((await get("/bookings", "meena")).status, 403, "calendar off");
        assert.equal((await get("/audit-logs", "meena")).status, 403, "reports off");
        assert.equal((await post("/notifications/broadcast", "meena", { message: "hi", audience: "everyone" })).status, 403);
        assert.equal((await post("/plans/draft", "meena", { messages: ["x"] })).status, 403);
        assert.equal((await get("/tasks", "anil")).status, 200, "staff unaffected");
    });
});

describe("festivals, plans and reports", () => {
    test("festivals: committee manages, staff can see", async () => {
        const date = inDays(20).toISOString().slice(0, 10);
        const f = await post("/festivals", "meena", { name: "Test festival", date, kind: "festival", confirmed: true, remind: true });
        assert.equal(f.status, 201);
        assert.ok((await get(`/festivals?from=${date}&to=${date}`, "anil")).body.festivals.length >= 1);
        assert.equal((await post("/festivals", "anil", { name: "x", date })).status, 403);
        const home = await get("/festivals/home", "raghu");
        assert.equal(home.body.reminder?.festival.name, "Test festival", "planning reminder within 6 weeks");
        assert.equal((await del(`/festivals/${f.body.festival.id}`, "raghu")).status, 200);
    });
    test("Plan with AI drafts and confirms an event with tasks (built-in planner)", async () => {
        const day = inDays(30).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        const d = await post("/plans/draft", "raghu", { messages: [`Test puja, 15 people, ${day} 10am`] });
        assert.equal(d.status, 200);
        assert.ok(d.body.draft, d.body.reply);
        const c = await post("/plans/confirm", "raghu", { event: d.body.draft.event, tasks: d.body.draft.tasks });
        assert.equal(c.status, 201);
        assert.equal(c.body.booking.kind, "event");
        assert.equal((await post("/plans/confirm", "raghu", { event: d.body.draft.event, tasks: [] })).status, 409, "slot now taken");
    });
    test("Ask AI says it isn't connected without a key", async () => {
        assert.equal((await post("/ai/ask", "raghu", { question: "Who is on site?" })).status, 503);
    });
    test("nightly report for a finished day, not for today", async () => {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        const r = await post(`/reports/daily/${yesterday}`, "raghu");
        assert.equal(r.status, 200);
        assert.equal(r.body.report.written_by, "rules");
        assert.ok(r.body.report.summary.length > 10);
        assert.equal((await post(`/reports/daily/${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}`, "raghu")).status, 400);
    });
});
