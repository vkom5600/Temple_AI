# Phase 1 Report – Foundation

| | |
|---|---|
| **Project** | Temple AI – Operations & Management System, release 1.0.0 |
| **Phase** | 0 (setup) + 1 (foundation) |
| **Branch** | `phase-1` (from `main` + `frontend-prototype`) |
| **Date** | 16 November 2026 |
| **Built by** | Venkat, using Claude Code in VS Code |
| **For** | Mega (next developer), Rohit and the project lead (review) |
| **Short version** | [phase-1.md](phase-1.md) is the one-page summary to load into the Claude project context |

---

## 1. Summary

Phase 1 builds the base every later module sits on: **who can sign in, what each role can see, how people join, and how the system records and announces what happens.**

By the end of the phase:

- Everyone signs in with email and password. The four roles (chairman, committee, staff, volunteer) each land on the right home screen.
- New people can **register themselves**. Their account waits until the **chairman approves or rejects it**, as the design documents describe.
- The chairman manages people (add, edit, reset password, deactivate). The committee can view them.
- Every important action is written to an **audit log**. People are told about things through an in-app **notification bell** and through **email**.
- The chairman has a **Settings** page to open or close registration and switch sign-in alert emails on or off.
- The frontend is now **TypeScript**, built on the existing prototype's look and feel.
- The repository has **coding standards**, a **README** with setup steps, **demo accounts** and **phase notes**.

The plan's Phase 1 "done" criteria are met: *each role logs in, lands on the right home screen, and only the chairman can add people.*

---

## 2. Where we started

The GitHub repository had two branches:

| Branch | Contents | Author |
|---|---|---|
| `main` | A Node/Express backend covering **every** module (auth, users, tasks, attendance, bookings, AI, calendar, reports, jobs) plus one `schema.sql`. Several empty placeholder files (`README.md`, `jas.txt`, `description.txt`, `weekend_monday_sprint.txtt`). | Mega (uploaded 3 Nov) |
| `frontend-prototype` | A React + Vite prototype with every screen (dashboard, tasks, issues, bookings, people, assistant, staff mobile home), running entirely on **mock data** in a local store. No real login. | Venkat (4 Nov) |

What we found when reviewing them:

1. **The backend was ahead of the plan but not runnable as-is.** `server.js` imported the AI, calendar and report modules, which **crash on startup** when `ANTHROPIC_API_KEY` or the Google keys are missing. A fresh clone could not start.
2. **The schema didn't match the design documents in places.** It had no `phone` on users and no approval status. Staff profiles had `job_title`/`availability` rather than the logical model's `designation`, and timestamps had no time zone.
3. **Roles didn't line up.** The prototype assigns work to *jobs* (priest, cook, cleaner…); the backend only knows four *access* roles.
4. **Line endings were mixed.** Mega's files use Windows (CRLF) line endings, Venkat's use Mac (LF). Without a rule, every edit would show whole files as changed.
5. **The frontend and backend had never been connected.**

---

## 3. Decisions made (and why)

Each of these was asked and answered before code was written.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Where do jobs (priest, cook…) live? | `users.role` = **access** (4 values). `staff_profiles.designation` = **job**. | Matches the logical data model (STAFF_PROFILES has a designation column). Permissions stay simple (4 roles), and Phase 2 can still assign a task to "all cleaners". |
| 2 | How do people sign in? | **Email + password** for everyone. | As in the login sequence and activity diagrams. A PIN for a shared tablet can be a later release. |
| 3 | What happens to prototype pages that aren't built yet? | **Hidden.** Moved to `frontend/src/prototype/` unchanged and ported page by page in their phase. | Mixing mock and real data confuses testing (mock users don't exist in the database). Nothing is lost. |
| 4 | JavaScript or TypeScript? | **TypeScript frontend**, **JavaScript backend**. | The architecture diagram says "React.js + TypeScript" for the frontend and plain Node/Express for the backend. Keeping the backend in JS leaves Mega's code untouched. |
| 5 | Self-registration (from the designs)? | **Yes, in Phase 1.** The **applicant picks the role**; the chairman approves or rejects. | It's part of signing in, so it belongs in the foundation. Matches the User Registration and Chairman Approval sequence diagram. |
| 6 | Public User / Pilgrim role (from the activity diagram)? | **No 5th role.** Outside people join as **volunteers**. *(Our reading of the answer "add a volunteer role"; to be confirmed.)* | Keeps the role model at four, which every permission check already uses. Easy to add later. |
| 7 | Email? | **nodemailer**. Emails **print to the terminal** when no SMTP server is set. | We can build and test every email now without an email account; real sending is just `.env` settings. |
| 8 | Chairman emailed on every sign-in? | **Yes, as designed**, but with a **switch in Settings** to turn it off. | With ~12 people it could be several emails a day. The chairman decides. |
| 9 | Line endings | **LF in the repository** (`.gitattributes`). | Windows and Mac both work; diffs show only real changes. |
| 10 | Mega's later-phase modules | **Kept unchanged**, but **not switched on** in `server.js` until their phase. | They need tables that don't exist yet, and some crash without API keys. |

---

## 4. What was done, step by step

### Step 0 – Repository setup

1. Cloned the repository to `~/Projects/Temple_AI` and opened it in VS Code.
2. Created branch **`phase-1`** from `main` and merged `frontend-prototype` into it, so the backend and frontend live together.
3. Added **`.gitattributes`** (LF line endings) and converted all text files. **Mega's files changed only in line endings; no code changed** (checked file by file with `git diff --ignore-cr-at-eol`).
4. Added a root **`.gitignore`** (`node_modules`, `.env`, `dist`).

### Step 1 – Database

1. Replaced the single `schema.sql` with **numbered migrations** (`backend/database/migrations/`). Mega's original moved to `database/reference/schema_draft.sql` as the starting point for later phases.
2. Wrote **`001_foundation.sql`**: `users`, `staff_profiles`, `notifications`, `audit_logs`, `settings` (see section 6).
3. Wrote **`scripts/db.js`**, which applies migrations in order and records them in a `schema_migrations` table:
   - `npm run db:migrate`: apply anything new (run after every pull)
   - `npm run db:seed`: add demo accounts
   - `npm run db:reset`: wipe, migrate, seed (blocked when `NODE_ENV=production`)
4. Wrote **`scripts/seed.js`**: 13 demo accounts, covering every role, every job and two pending registrations.
5. Created a fresh local database `temple_ai`. (An older experimental database, `temple_management`, was left untouched.)

### Step 2 – Backend API

1. **`config/env.js`** loads `.env` and stops the server with a clear message if the database settings or `JWT_SECRET` are missing or weak.
2. **`server.js`** now mounts only Phase 1 routes. Later-phase routes are listed but commented out, and it has a JSON 404 and a central error handler.
3. **Auth middleware** checks the token, then re-reads the user from the database on every request, so a deactivated account or changed role takes effect immediately. Only *approved and active* users pass.
4. **Rate limiting** on login and registration: 10 attempts per 15 minutes per IP + email.
5. **Login** gives the same message for a wrong email and a wrong password (it doesn't reveal which emails exist), then reports pending, rejected or deactivated accounts only once the password is correct.
6. **People management** (chairman): add (creates the user and profile in one transaction), edit, reset password, approve, reject with a reason, deactivate/reactivate. The committee can read only.
7. **Shared helpers** that every later module must use:
   - `logAudit()`: writes an audit row and never breaks the main action.
   - `notify()`: sends an in-app notification to people, roles **or jobs**, never duplicates, active + approved users only.
   - `sendEmail()` + `emailTemplates.js`: one place for all email wording.
   - `getSetting()`: reads the chairman's switches.
   - Mega's older names (`createAuditLog`, `sendNotificationSafely`, `notifyRolesSafely`) still work, so her task and booking code needs no changes.

### Step 3 – Frontend (TypeScript)

1. Moved the prototype to `src/prototype/` (history kept with `git mv`) and excluded it from compilation.
2. Added TypeScript (strict), React Router 7, and a Vite **proxy**, so the browser calls `/api` and Vite forwards it to the backend (no CORS problems in development).
3. Built the Phase 1 app reusing the prototype's styles, icons, avatar, modal and staff "day hero" with the mandala (section 8).

### Step 4 – Sign-in flow from the design documents

After the first pass, we re-read the latest design document (`Temple AI Operations and Management System (6).docx`) and added what its login, registration and login-email diagrams describe: self-registration, the approval queue, account-state messages, emails and the Settings page. Phase 1 wasn't merged yet, so these went into migration 001 rather than a new migration.

### Step 5 – Documentation

`README.md` (setup, demo accounts, Mac port note), `docs/STANDARDS.md` (naming and conventions, **to be agreed by both developers**), `docs/phases/phase-1.md` (summary) and this report.

---

## 5. How the pieces fit

```
Browser (React + TypeScript)
   │  fetch /api/...  (with "Authorization: Bearer <token>")
   ▼
Vite dev server ── proxy ──►  Express API (Node)
                                │
                                ├─ authRateLimit         (login / register only)
                                ├─ authenticateToken     (who are you? approved + active?)
                                ├─ authorizeRoles(...)   (are you allowed?)
                                ├─ controller            (validate → SQL → respond)
                                │     ├─ logAudit()      → audit_logs
                                │     ├─ notify()        → notifications  (the bell)
                                │     └─ sendEmail()     → SMTP or terminal
                                ▼
                             PostgreSQL (temple_ai)
```

### Backend folders

```
backend/
  server.js                    mounts routes (Phase 1 only), 404 + error handler
  config/        env.js, db.js
  database/
    migrations/  001_foundation.sql
    reference/   schema_draft.sql   (Mega's full draft, for later phases)
  middleware/    authMiddleware.js, rateLimitMiddleware.js, errorMiddleware.js
  routes/        authRoutes, userRoutes, notificationRoutes, settingsRoutes (+ later phases, not mounted)
  controllers/   authController, userController, notificationController, settingsController (+ later phases)
  services/      auditService, notificationService, emailService, emailTemplates, settingsService (+ later phases)
  utils/         userValidation.js   (shared by registration and people management)
  scripts/       db.js, seed.js, createChairman.js
```

### Frontend folders

```
frontend/src/
  main.tsx, App.tsx      entry + routes
  api/                   client.ts (fetch + token + errors), endpoints.ts (every API call)
  auth/                  AuthContext (who is signed in), RequireRole (route guard)
  components/            ui.tsx, NotificationBell.tsx, Toast.tsx
  layouts/               AdminLayout (sidebar), StaffLayout (mobile)
  pages/                 LoginPage, RegisterPage, admin/*, staff/*
  lib/format.ts          dates, greetings
  types.ts, constants.ts
  styles.css             prototype styles + Phase 1 additions at the bottom
  prototype/             original mock-data prototype (reference only)
```

---

## 6. Data model (migration 001)

### users

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| full_name | VARCHAR(100) | required |
| email | VARCHAR(150) UNIQUE | always stored lower-case (CHECK) |
| password_hash | TEXT | bcrypt, cost 12 |
| role | VARCHAR(20) | `chairman` / `committee` / `staff` / `volunteer` |
| phone | VARCHAR(20) | optional |
| is_active | BOOLEAN | false = deactivated by chairman |
| approval_status | VARCHAR(20) | `pending` / `approved` / `rejected`. Added directly by the chairman = approved |
| reviewed_by, reviewed_at | FK users, TIMESTAMPTZ | who approved/rejected and when |
| rejection_reason | TEXT | shown to the applicant |
| created_at, updated_at | TIMESTAMPTZ | `updated_at` maintained by trigger |

**Who can sign in:** `approval_status = 'approved' AND is_active = true`.

### staff_profiles (one per user)

`user_id` (unique FK, cascade), `designation` (`priest`, `cook`, `cleaner`, `caretaker`, `security`, `maintenance`; staff only), `emergency_contact`, `joining_date`, timestamps.

### notifications

`user_id`, `title`, `message`, `notification_type` (`general`, `account`, `registration`, … later `task`, `attendance`), `is_read`, `created_at`. Indexed for "my unread, newest first".

### audit_logs

`actor_id` (kept as NULL if the user is deleted), `action` (`<entity>.<past tense>`, e.g. `user.approved`), `entity_type`, `entity_id`, `details` (JSONB, e.g. what changed from/to), `created_at`.

Actions written in Phase 1: `user.logged_in`, `user.registered`, `user.created`, `user.updated` (with a field-by-field diff), `user.approved`, `user.rejected`, `user.activated`, `user.deactivated`, `setting.updated`.

### settings

`setting_key` (unique), `setting_value` (text; booleans as `'true'`/`'false'`), `category`, `updated_by`, `updated_at`. Seeded with `registration_open = true` and `login_alert_to_chairman = true`.

---

## 7. API reference

All responses are JSON: `{ "success": true, ... }` or `{ "success": false, "message": "..." }`.

### Auth (`/api/auth`)

| Method | Path | Access | Body → Result |
|---|---|---|---|
| GET | `/registration-status` | public | → `{ open }` |
| POST | `/register` | public, rate-limited | `{ full_name, email, password, role, designation?, phone? }` → 201. Pending account; notifies and emails the chairman; emails the applicant. 403 if registration is closed, 409 if the email exists. |
| POST | `/login` | public, rate-limited | `{ email, password }` → `{ token, user }`. 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_PENDING` / `ACCOUNT_REJECTED` (with reason) / `ACCOUNT_INACTIVE`. On success, emails the user, and the chairman if that setting is on. |
| GET | `/profile` | signed in | → `{ user }` |

### People (`/api/users`)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/` (`?status=pending\|approved\|rejected`) | chairman, committee | |
| GET | `/:id` | chairman, committee | |
| POST | `/` | chairman | Same body as register (+ `emergency_contact`, `joining_date`). Approved immediately; welcome notification. |
| PUT | `/:id` | chairman | Full replace (send every field). `password` only to reset it. The chairman account can't be edited here. |
| PATCH | `/:id/approve` | chairman | pending or rejected → approved; notification + email |
| PATCH | `/:id/reject` | chairman | `{ reason }` required (≤500 characters); email |
| PATCH | `/:id/deactivate`, `/:id/activate` | chairman | Not on yourself or the chairman |

### Notifications (`/api/notifications`, own only)

`GET /`, `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`.

### Settings (`/api/settings`, chairman)

`GET /` → list with labels; `PUT /:key` with `{ value: true|false }`.

### Health

`GET /api/health` → API and database status.

### Status codes used

200, 201 created, 400 bad input, 401 not signed in / wrong password, 403 not allowed or account state, 404, 409 duplicate email, 429 too many attempts, 500.

---

## 8. Screens

| Screen | Route | Who | What it does |
|---|---|---|---|
| Sign in | `/login` | everyone | Email + password; server messages shown as-is; "Register" link; demo-account shortcuts **in development only** |
| Register | `/register` | everyone | "Join as" Volunteer / Staff (+ job) / Committee, details, password + confirm; "registration closed" message when the chairman has closed it; confirmation after sending |
| Admin home | `/admin` | chairman, committee | Greeting and date; **"N registrations waiting"** card (chairman); team counts by role |
| People | `/admin/people` | chairman (edit), committee (view) | Grouped by role; **Registrations queue** (approve / reject with reason / "approve after all"); add/edit modal with role, job, contact details and password; deactivate/reactivate; inactive list |
| Settings | `/admin/settings` | chairman | Two switches: registration open, sign-in alert emails |
| Staff home | `/staff` | staff, volunteer | Time-of-day hero with mandala (from the prototype); latest updates |
| Notification bell | both layouts | everyone | Unread count (refreshes every minute), panel, mark one / all read |

Route guards send signed-out people to `/login` (and back to where they were after signing in) and anyone in the wrong area to their own home. **The API enforces the same rules**, so hiding a button is never the only protection.

The saved sign-in survives a page refresh. An expired or revoked token signs the user out automatically.

---

## 9. Emails

| When | To | Template |
|---|---|---|
| Someone registers | applicant | `registrationReceived` |
| Someone registers | chairman | `newRegistrationAlert` (links to People) |
| Chairman approves | applicant | `registrationApproved` (links to sign in) |
| Chairman rejects | applicant | `registrationRejected` (includes reason) |
| Anyone signs in | that person | `loginNotice` ("if this wasn't you…") |
| Non-chairman signs in | chairman, if the setting is on | `loginAlertToChairman` (links to Settings) |

Emails are sent **in the background**: a slow or failed email never delays or breaks sign-in or registration.

**To send real email**, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM` in `backend/.env` (for Gmail, use an app password). Until then, each email appears in the backend terminal.

---

## 10. How it was tested

No automated test suite yet (listed under next steps). Testing was done by hand against the running app.

### API (curl scripts, every endpoint)

| Area | Checked | Result |
|---|---|---|
| Login | correct; wrong password; unknown email (same message); invalid JSON; deactivated; pending; rejected (with reason) | ✅ |
| Permissions | no token → 401; staff listing people → 403; committee add/approve/settings → 403 | ✅ |
| People | add; duplicate email → 409; staff without job → 400; edit + password reset; editing the chairman → 403; deactivate/reactivate; invalid id → 404 | ✅ |
| Registration | invalid input; trying to register as chairman → 400; success; duplicate; closed → 403 | ✅ |
| Approval | reject without reason → 400; reject; approve; approve twice → 404 | ✅ |
| Notifications | welcome, password-reset and new-registration notices; unread count; mark all read | ✅ |
| Settings | list; invalid value → 400; open/close registration; login alert off → no chairman email | ✅ |
| Audit | correct rows and details for every action above | ✅ |
| Later-phase modules | all still import (except AI/calendar/reports without keys, as before) | ✅ (known) |

### Browser (Chrome, real backend)

Signed in as chairman, committee, staff and volunteer; correct home each time. A staff member typing `/admin/people` is sent back to `/staff`. The chairman added a person through the form. The new person signed in, saw the welcome in the bell, and marked it read. A new volunteer registered through `/register`, saw the "waiting for approval" message when signing in, and was then approved by the chairman. A second registration was rejected with a reason. Settings switches were toggled and saved. The sign-in survived a page reload. **No console errors.**

Frontend `npm run typecheck` and `npm run build` pass.

---

## 11. Where this differs from the design documents

| Design says | Built | Reason |
|---|---|---|
| Login emails are triggered by a second call from the frontend after sign-in | Sent by the server during `/auth/login` | One request instead of two, and it can't be skipped by a closed tab |
| Separate Chairman and Committee dashboards | One admin layout; the chairman additionally sees Settings and the edit/approve controls | Same screens, fewer files; differences are permissions |
| Public User / Pilgrim dashboard | Not built; outside people register as volunteers | Decision 6 (to be confirmed) |
| Logical model: `audit_logs.user_id`, `old_values`, `new_values` | `actor_id`, `details` (JSONB with from/to) | Mega's schema and code already used these names; `details` holds the before/after |
| Logical model: BIGINT ids | SERIAL (integer) | The pg driver returns BIGINT as text, which breaks id comparisons in JavaScript |
| Use case "Manage Committee Permissions" | Not in Phase 1 | Committee permissions are fixed by role for v1.0 |

---

## 12. Known issues and limits

- **AI, calendar and report modules crash on startup without their API keys.** Phase 3 must add the planned "fallback when no key" before mounting them.
- **Task statuses disagree across sources:** the prototype (to do / awaiting / verified / flagged), Mega's schema (assigned / completed / pending_verification / approved / closed) and the activity diagram (pending verification / rework / rejected / approved). **Agree on one list before Phase 2.**
- No "change my own password" or "forgot password" screen yet; the chairman resets passwords from People.
- Login rate limiting is held in memory (resets when the server restarts; fine for one server).
- No automated tests.
- **macOS:** port 5000 is taken by AirPlay Receiver, so use 5001 locally (README).
- Rejected applicants can't register again with the same email. The chairman can use "approve after all".

---

## 13. For Mega: getting started on this branch

```bash
git fetch origin
git checkout phase-1
cd backend && npm install && cp .env.example .env    # set DB_USER / DB_PASSWORD / JWT_SECRET
createdb temple_ai && npm run db:reset && npm run dev
cd ../frontend && npm install && cp .env.example .env && npm run dev
```

Sign in as `raghu@temple.demo` with the `DEMO_PASSWORD` from `.env`.

**Before starting Attendance (Phase 2):**

1. Read `docs/STANDARDS.md` and say what you'd change; we agree it together.
2. Make your branch from `phase-1` (or from `main` once phase-1 is merged): `git checkout -b feature/attendance`.
3. Add `database/migrations/002_attendance.sql` (start from `reference/schema_draft.sql`; don't edit 001).
4. Use `logAudit()` and `notify()` (e.g. `notify({ roles: ["chairman"], ... })` for the missed leaving check).
5. Uncomment the attendance route in `server.js` and port the screens from `frontend/src/prototype/` into `src/pages/`.

---

## 14. Next steps

1. **Review this branch** (Mega, then Rohit/lead) and merge `phase-1` into `main`.
2. **Confirm decision 6** (no Public/Pilgrim role).
3. **Agree on `STANDARDS.md`.**
4. **Agree on the task status list** (section 12) before Phase 2.
5. Phase 2 in parallel: Tasks + Issues (Venkat), Attendance (Mega).
6. Decide on hosting before Phase 4 (database, API and frontend hosting, real SMTP).
