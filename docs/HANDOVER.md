# Temple AI – Handover (start here)

**For:** Mega (and anyone joining the project)
**Written:** 17 November 2026, at the end of Phase 2
**Read time:** about 20 minutes. Read sections 1–4 first, then dip into the rest when you need it.

This document explains **everything built so far, how to run it, how it fits together, what we decided and why, and what comes next.** The detailed notes for each phase are linked where relevant:

| Phase | Notes |
|---|---|
| 0 + 1 Foundation | [phases/phase-1-report.md](phases/phase-1-report.md) (full) · [phases/phase-1.md](phases/phase-1.md) (one page) |
| 2 Tasks + Issues | [phases/phase-2-tasks.md](phases/phase-2-tasks.md) |
| 2 Attendance | [phases/phase-2-attendance.md](phases/phase-2-attendance.md) |
| Coding rules | [STANDARDS.md](STANDARDS.md) |

---

## 1. Where things stand

| Phase (from the plan) | Status |
|---|---|
| 0 – Setup (repo, standards, env, demo accounts) | ✅ Done |
| 1 – Foundation (login, roles, people, notifications, audit) | ✅ Done, plus **self-registration with chairman approval** from the design docs |
| 2 – Daily operations: Tasks + Issues | ✅ Done |
| 2 – Daily operations: Attendance | ✅ Done (this was going to be Mega's half; Venkat built it, **please review it**) |
| Design pass: screens rebuilt to the Stitch designs (front-end final review) | ✅ Done on `feature/ui-design`. **Full status by page ID: `docs/PROGRESS-REPORT.md`** |
| 3 – Bookings + Google Calendar, AI assistant | ⏳ Next. Draft code exists from Mega's first upload (section 9) |
| 4 – Reports, announcements, audit page, scheduled jobs, wiring modules together | ⏳ After 3 |
| 5 – Cleanup / audit / test, tagged release 1.0.0 | ⏳ Last |

### Branches on GitHub

```
main                    Mega's original upload (untouched)
frontend-prototype      Venkat's original mock-data prototype (untouched)
phase-1                 Phases 0 + 1
  └─ feature/tasks      + Tasks and Issues
       └─ feature/attendance   + Attendance + this handover
            (phase-2    the same commit as feature/attendance: "Phase 2 finished")
            └─ feature/ui-design   + every Phase 1–2 screen rebuilt to the Stitch designs   ← the newest, has everything
```

Each branch is built on the one above it. **To see or run everything, use the newest one, `feature/ui-design`.**

**Merge order into `main`** (after review): `phase-1` → `feature/tasks` → `feature/attendance` → `feature/ui-design`. Merging in that order gives no conflicts.

---

## 2. Run it on your laptop (Windows)

You need **Node.js 20+**, **PostgreSQL 14+** (the installer includes pgAdmin) and **Git**.

```powershell
# 1. Get the code
git clone https://github.com/vkom5600/Temple_AI.git
cd Temple_AI
git checkout feature/attendance

# 2. Create the database (enter your postgres password when asked)
psql -U postgres -c "CREATE DATABASE temple_ai"
#    (or in pgAdmin: right-click Databases > Create > Database > temple_ai)

# 3. Backend
cd backend
copy .env.example .env
#    Edit backend\.env:
#      DB_USER=postgres
#      DB_PASSWORD=<your postgres password>
#      JWT_SECRET=<long random text; make one with:>
#        node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm install
npm run db:reset        # creates all tables + demo people, tasks, attendance
npm run dev             # API on http://localhost:5000

# 4. Frontend (second terminal)
cd frontend
copy .env.example .env  # default points at port 5000, fine on Windows
npm install
npm run dev             # open http://localhost:5173
```

**Every demo account's password is `Temple@1234`** (`DEMO_PASSWORD` in `backend/.env`). On the login page in development there are buttons that fill in the demo emails.

| Who | Email | Sees |
|---|---|---|
| Chairman | `raghu@temple.demo` | Admin side; can manage people, settings, approvals |
| Committee | `meena@temple.demo`, `suresh@temple.demo` | Admin side; can manage tasks and attendance, view people |
| Staff | `anil` (priest), `kamla` (cook), `ramesh` (cleaner), `jaya` (caretaker), `dev` (security), `harish` (maintenance) `@temple.demo` | Mobile staff home |
| Volunteer | `priya@temple.demo`, `vikram@temple.demo` | Mobile staff home + Sign-offs tab |
| Waiting for approval | `anita@temple.demo`, `mohan@temple.demo` | Can't sign in until the chairman approves them |

**Emails** (registration, reminders, closing alerts…) are **printed in the backend terminal** until SMTP settings are filled in `backend/.env`.

**After pulling new code:** run `npm run db:migrate` in `backend/` (adds any new tables). `npm run db:reset` wipes everything and reloads the demo data, which is useful when testing gets messy.

**Mac only:** port 5000 is used by AirPlay. Use `PORT=5001` and `VITE_API_PROXY_TARGET=http://localhost:5001`.

---

## 3. A 10-minute tour (do this once)

1. **Sign in as Raghu (chairman).**
   - **Home:** registrations waiting (Anita, Mohan); *Today* (tasks done, overdue, waiting for sign-off, open issues); *Who's here*; "Helping on site today?"; the team.
   - **People:** approve Anita, reject Mohan (with a reason); add a person; edit one.
   - **Tasks:** *New task*, pick a template, give it to *Cleaner* **and** *Volunteers* (one task each). Open a task: details, history, remind, reopen, cancel, edit.
   - **Issues:** "Side door lock is broken" → *Create task* (pre-filled) → it moves to *Handled*.
   - **Sign-offs:** sign off "Lock Community Hall".
   - **Who's on:** today and yesterday; *Mark absent*; *Add* a forgotten check-in.
   - **Settings:** registration open, sign-in alert emails, closing time.
2. **Sign in as Ramesh (cleaner).** Tap *I'm here*; tick a task; *Undo*; *Can't do this?* on another; *Report a problem*.
3. **Sign in as Priya (volunteer).** *Sign-offs* tab; *I'm here* then *I'm leaving*. If she's the last one in, she gets the lamps / gas / doors checklist.
4. **Back as Raghu:** check the bell (notifications) and the backend terminal (emails).
5. **Register** a new person at `/register` → sign in (shows "waiting for approval") → approve as Raghu.

---

## 4. How it fits together

```
Browser (React + TypeScript)  ──/api──►  Express API (Node.js, JavaScript)  ──►  PostgreSQL
  frontend/src/                            backend/                                temple_ai
                                             ├ middleware: who are you? are you allowed?
                                             ├ controllers: check input → SQL → reply
                                             ├ services: logAudit · notify · sendEmail · tasks · attendance
                                             └ jobs (node-cron): repeating tasks · evening closing check
```

### Folders you'll touch most

| Where | What |
|---|---|
| `backend/database/migrations/` | `001_foundation.sql`, `002_tasks_issues.sql`, `003_attendance.sql`. **The real schema.** New tables go in a new numbered file. |
| `backend/database/reference/schema_draft.sql` | Mega's original full draft. Use it as the starting point for Phase 3/4 tables. |
| `backend/routes/` + `controllers/` | One pair per module (auth, users, notifications, settings, tasks, issues, attendance, …) |
| `backend/services/` | Shared logic: `auditService` (`logAudit`), `notificationService` (`notify`), `emailService` + `emailTemplates`, `settingsService`, `taskService`, `attendanceService` |
| `backend/server.js` | Mounts routes. **Phase 3/4 routes are commented out** until their tables exist |
| `backend/scripts/` | `db.js` (migrate / seed / reset), `seed.js` (demo data) |
| `frontend/src/api/endpoints.ts` | **Every** call to the backend lives here |
| `frontend/src/types.ts` | Shapes of the data the API returns |
| `frontend/src/pages/` | One file per screen (`admin/…`, `staff/…`, `LoginPage`, `RegisterPage`) |
| `frontend/src/components/` | Shared UI (`ui.tsx`), `tasks/…`, `attendance/…`, `NotificationBell`, `Toast` |
| `frontend/src/layouts/` | `AdminLayout` (sidebar + counts), `StaffLayout` (mobile) |
| `frontend/src/prototype/` | The original mock-data prototype. **Not compiled.** Copy pages from here when building Bookings, Assistant, Dashboard. |

### Rules that run through everything

- **Roles:** `users.role` is *access* (chairman / committee / staff / volunteer). `staff_profiles.designation` is the *job* (priest, cook, cleaner, caretaker, security, maintenance). Admins = chairman + committee.
- **Signing in:** email + password → a token (JWT, 12 hours). Only **approved + active** users can sign in or get notifications.
- **Permissions are enforced by the API**, not only by hiding buttons. Each route says who may call it (`authorizeRoles(...)`), and controllers check ownership (e.g. "this task is yours").
- **Every change** calls `logAudit(...)`. **Every "someone should know"** calls `notify(...)`. Emails go through `sendEmail(...)`.
- **Times:** stored as `TIMESTAMPTZ`. "Today", overdue and repeats use `TEMPLE_TIMEZONE` (Europe/London).
- **API replies** always look like `{ success: true, ... }` or `{ success: false, message: "plain English" }`.

---

## 5. What each module does (short version)

### Accounts and people (Phase 1)
- **Register** at `/register`: name, email, phone, password, "join as" volunteer / staff (+ job) / committee → **pending**. The chairman is notified and emailed.
- **Chairman approves or rejects** (reason required) on People. Approved = can sign in. Login says clearly if an account is pending, rejected (with the reason) or deactivated.
- The chairman can also **add people directly**, edit them, reset passwords, and deactivate or reactivate them. The committee can view only.
- **Emails:** registration received / approved / rejected; on every sign-in, a notice to the user plus an alert to the chairman (can be switched off in Settings).
- **Settings** (chairman): registration open/closed, sign-in alerts on/off, evening closing time.
- **Notification bell** everywhere, with unread count and mark read.

### Tasks + Issues (Phase 2)
- A task goes to **one person** or **one group** (a job, all staff, volunteers or committee). A group task is **one shared task**: whoever does it, it's done.
- **Statuses:** `todo` → `done`; safety tasks: `todo` → `awaiting_signoff` → `done` (or sent back to `todo` with a note); `flagged` = "couldn't do"; `cancelled`.
- **Safety tasks** need a **second person** (volunteer, committee, chairman) to sign off, **never the doer** (enforced in the database too).
- **Repeating** daily/weekly tasks: a job creates the next copy, at the same UK clock time.
- **Issues:** anyone reports a problem; "Can't do this?" flags the task and opens an issue. Admins **resolve** it (the blocked task goes back on the list) or **turn it into a task**.
- **Reminders:** bell + email, at most every 5 minutes per task.

### Attendance (Phase 2)
- **I'm here** (undo within 10 min), **I'm leaving**, **I'm back**. One record per person per day.
- **Last person out** ticks lamps, gas and doors; skipping any of them tells the chairman.
- **Evening check** after the closing time: anyone still in, or no closing confirmation → the chairman is told.
- Chairman/committee can opt in with **"I'm helping today"**.
- **Who's on:** any day; gaps by job; closing status; mark absent / add / correct / remove (the person is notified).

---

## 6. Decisions log (all of them, in one place)

| # | Decision | Why |
|---|---|---|
| 1 | Access role (4) separate from job (designation) | Simple permissions; tasks can still go to "all cleaners" |
| 2 | Email + password sign-in | As in the design docs; a tablet PIN could come later |
| 3 | Prototype pages hidden until their phase (kept in `src/prototype/`) | No mixing of mock and real data |
| 4 | Frontend TypeScript, backend JavaScript | As in the architecture doc; Mega's backend code unchanged |
| 5 | Self-registration; applicant picks a role; chairman approves | From the registration sequence diagram |
| 6 | **No separate Public/Pilgrim role:** outside people join as volunteers | Venkat's answer ("add a volunteer role"). **Still to confirm with the lead**, because it affects Phase 3 bookings (section 8) |
| 7 | Email via nodemailer; printed to the terminal without SMTP | Build and test all email now, send for real later |
| 8 | Sign-in alerts to the chairman, with an off switch | As designed, without spamming the chairman |
| 9 | LF line endings (`.gitattributes`) | Windows + Mac both fine; clean diffs |
| 10 | Only **safety** tasks need sign-off (not every task) | The chairman shouldn't approve every sweep |
| 11 | Sign-off by volunteers / committee / chairman, never the doer | As in the prototype |
| 12 | Group task = one shared task | Works with shifts and cover |
| 13 | Repeating tasks in Phase 2 | The daily routine shouldn't be re-typed every day |
| 14 | One task status list: `todo / awaiting_signoff / done / flagged / cancelled` | Replaces three conflicting lists |
| 15 | Staff + volunteers check in; admins can opt in | Venkat's answer |
| 16 | Evening closing check at a time set in Settings | Catches people who forget to tap "I'm leaving" |
| 17 | Phase 3/4 routes switched off until built | They crash without API keys and need tables that don't exist yet |
| 18 | **Stitch design system**: indigo + saffron + green from the VHP logo and website, Inter font, VHP logo everywhere; a faded gopuram behind pages for a temple feel | The agreed designs (front-end final review). The gopuram can be removed in one line if the committee prefers |
| 19 | Temple name and logo in one place (`frontend/src/branding.ts`, `public/vhp-logo.png`) | "Ilford Hindu Centre · Vishwa Hindu Parishad (UK)", as in the designs |
| 20 | Suggestions ("✦ …") and "Assign Harish" are rule-based until the AI assistant | Useful now; Phase 3 swaps in Temple AI. Calendar = Google Calendar (Phase 3) |

---

## 7. What changed from Mega's first upload

| Your file | What happened |
|---|---|
| `database/schema.sql` | Moved to `database/reference/schema_draft.sql`; replaced by numbered migrations |
| `controllers/authController.js`, `userController.js` | Rewritten (registration, approval, safer login, phone/job, audit, notifications) |
| `middleware/authMiddleware.js` | Kept `authenticateToken` / `authorizeRoles`; now also checks approval |
| `services/auditService.js`, `notificationService.js` | New `logAudit()` / `notify()`; **your old function names still work** |
| `controllers/notificationController.js` | Kept (one field added) |
| `controllers/taskController.js`, `routes/taskRoutes.js` | Rewritten for the full task rules |
| `controllers/attendanceController.js`, `routes/attendanceRoutes.js` | Rewritten for leave/back, closing checks, Who's On |
| `scripts/createChairman.js` | Kept (for creating the real chairman in production) |
| Bookings, calendar, AI, reports, audit, jobs | **Untouched, not switched on yet.** Line endings only. See section 9 |

---

## 8. What's next

### Phase 3 – Bookings + Google Calendar, and the AI assistant

The plan splits it: **AI assistant (Venkat)** and **Bookings + Google Calendar (Mega)**.

**Bookings + Google Calendar** (plan):
- Table `bookings` (start from `bookings` in `schema_draft.sql`).
- Anyone requests a hall booking, or cancels their own. Admins approve/reject, or book directly. **Check for clashing times** in the same space.
- Approved bookings become **Google Calendar** events (the chairman connects the calendar once).
- Screens: **My Bookings**, admin **Bookings**, **Calendar connect**. The prototype has a full calendar page: `frontend/src/prototype/admin/Bookings.jsx`.
- Notifications/emails: request received → admins; approved/rejected → requester (templates go in `emailTemplates.js`).
- Done when: request → approve → shows on Google Calendar.

**AI assistant** (plan):
- Tables `ai_conversations`, `ai_messages`, `ai_knowledge_base` (start from the draft).
- Chat that answers **from the temple's own rules and records**, with history; admins add and close knowledge-base notes; **daily summary** and **task recommendations** for admins.
- Uses the **Claude API**, with a **simple rule-based fallback** when there's no key or the call fails (the draft `mockAIService.js` is a start).
- Screens: chat, admin **Assistant** page, daily **Brief** (prototype: `admin/Assistant.jsx`, `assistant.js`).
- Done when: the AI answers a question from the knowledge base.

**Decide before starting Phase 3:**
1. **Who can request a booking?** The design docs have a Public User / Pilgrim requesting rooms (public user activity diagram, booking sequence diagram). We decided outside people join as **volunteers**. Is that right for bookings, or do we need a public role after all?
2. **Bookable spaces:** the prototype uses Shivaji Hall, Community Hall, Room G37, Room G38. Confirm the real list, and whether rooms and events are booked differently (the draft has `booking_type` hall/room/event).
3. **Google account:** whose calendar, and who creates the Google Cloud OAuth client (client ID/secret)?
4. **Claude API key:** who pays for it, and which model (draft reads `CLAUDE_MODEL`).

### Phase 4 – Reports + wiring it together (plan)
- Tables `daily_reports`, `announcements`.
- **Daily report** made automatically at 00:05 or on demand, with an AI summary (draft: `reportService.js`, `dailyReportJob.js`).
- **Activity page** (audit log), **messages to all staff** (announcements; the prototype shows one at the top of the staff home), temple notes.
- **Overdue reminders every hour** (draft: `overdueReminderJob.js`).
- **Wiring:** approved booking → prep tasks (the prototype has the list in `lib.js` `bookingTasks`; the task API already accepts up to 50 tasks at once), issue → task (✅ done), missed leaving check → chairman (✅ done), sign-off alerts only to people checked in today.

### Phase 5 – Cleanup / test / release (from the kickoff call)
- Ask Claude for an **audit report**, then remove dead code (e.g. `src/prototype/` once everything is ported, the empty files in `progress/`, `backend/description.txt`).
- Add automated tests for the API (at least sign-in, permissions, tasks, attendance).
- Test deployment (hosting options are in the Phase 1 chat notes: Neon/Supabase + Render/Railway + Vercel/Netlify).
- Tag **release 1.0.0** on GitHub with notes.

---

## 9. Mega's draft code for Phase 3/4: what needs changing

These files exist from the first upload but are **not switched on** (`server.js` has them commented out):

| File | Before switching it on |
|---|---|
| `controllers/bookingController.js`, `routes/bookingRoutes.js` | Add a migration `004_bookings.sql`; check it uses `logAudit` / `notify` (old names work); add clash checking if missing |
| `controllers/calendarController.js`, `services/googleCalendarService.js`, `config/googleCalendar.js` | **Crashes on startup without Google keys.** Make it fail gently (feature off until the keys are set) |
| `controllers/aiController.js`, `services/claudeService.js` | **Crashes without `ANTHROPIC_API_KEY` / `CLAUDE_MODEL`.** Fall back to `mockAIService` instead. It also uses **old task statuses** (`approved`, `closed`) → change to `done`, `cancelled` |
| `services/conversationService.js`, `mockAIService.js` | Check against the new AI tables |
| `services/reportService.js`, `controllers/reportController.js`, `jobs/dailyReportJob.js` | Uses **old task statuses** (`assigned`, `completed`, `pending_verification`, `approved`) and needs `daily_reports` → update to `todo / awaiting_signoff / done / flagged / cancelled` |
| `jobs/overdueReminderJob.js` | Uses old statuses and `assigned_to` only → use `is_overdue` logic (`status = 'todo' AND due_at < NOW()`) and `notifyAssignees()` so group tasks work |
| `controllers/auditController.js`, `routes/auditRoutes.js` | Fine to mount for the Activity page (admins only) |

---

## 10. How to add the next module (checklist)

1. Branch from the newest branch: `git checkout feature/attendance && git checkout -b feature/bookings`.
2. **Migration:** `backend/database/migrations/004_bookings.sql` (the next free number; never edit an old one). Run `npm run db:migrate`.
3. **Backend:** `routes/xRoutes.js` + `controllers/xController.js`; protect routes with `authenticateToken` + `authorizeRoles`; call `logAudit()` on every change and `notify()` where someone should know; mount in `server.js`.
4. **Demo data:** add to `scripts/seed.js` (only when the table is empty) and call it from `scripts/db.js`.
5. **Frontend:** types in `types.ts` → calls in `api/endpoints.ts` → page(s) in `pages/` (port from `src/prototype/`) → route in `App.tsx` → nav item in `AdminLayout.tsx` (or a section on `StaffHome.tsx`).
6. **Test as every role**, including what each role must **not** be able to do.
7. `npm run typecheck` (frontend) must pass.
8. Write `docs/phases/phase-3-bookings.md` (same headings as the Phase 2 notes).
9. Push the branch; the other person reviews before it merges.

---

## 11. Working with Claude on this project (from the kickoff call)

- Load into the Claude project: `README.md`, `docs/HANDOVER.md`, `docs/STANDARDS.md`, the `docs/phases/` notes, and the design PDFs.
- Prompt as a **developer** with clear scope: *"Build Phase 3 Bookings as described in docs/HANDOVER.md section 8. Follow docs/STANDARDS.md. Only touch the bookings module. Stop and ask me before any decision that isn't in the docs."*
- After each phase, ask for a summary in `docs/phases/` (as we've done) so the next person can follow.
- Keep your own notes too. They're what stops you getting lost.

---

## 12. Known issues (all phases)

- **Times show in the device's time zone.** Fine at the temple (UK). From India a 21:10 UK time shows as 2:40 AM. Could switch to always showing UK time.
- **No rota / shift times**, so no "late" status.
- **Sign-off alerts** go to every volunteer + committee + the chairman (could be limited to people checked in).
- **No "change my password" / "forgot password"** yet; the chairman resets passwords.
- **No automated tests** yet (Phase 5).
- **Prototype parts still waiting for their feature:** the Events lane and Calendar (Phase 3 bookings), the request bar, Assistant page and AI summary (Phase 3), "Message to all staff" (Phase 4 announcements), festival names in the banners (observances, not planned yet).
- Lists show at most 500 tasks; no paging.
- The login rate limit is in memory (resets when the server restarts).
