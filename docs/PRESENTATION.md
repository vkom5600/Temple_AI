# Temple AI: presentation script (17 November 2026)

**For Megha**, presenting our joint progress to Pardha garu, Rao garu and the committee.
Read it once top to bottom; then follow sections 2–4 in the meeting.
Every screen below is a real screenshot of the app running on our demo data. You can show them straight from GitHub without running anything.

| | |
|---|---|
| **Branch to show** | `present-today` (everything is here) |
| **Repo** | https://github.com/vkom5600/Temple_AI/tree/present-today |
| **Full status by page** | [docs/PROGRESS-REPORT.md](PROGRESS-REPORT.md) |
| **Technical guide** | [docs/HANDOVER.md](HANDOVER.md) |

---

## 1. The 30-second version (say this first)

> "Namaste. This is our joint update.
> Phases 0, 1 and 2 of the plan are built and working end to end on a real database:
> - Sign-in for every role, with new people approved by the chairman.
> - Tasks with safety sign-off by a second person.
> - Problem reporting, and attendance with last-person lock-up.
>
> The screens follow the front-end designs we agreed on 11 November, in the temple's colours, with the VHP logo. Calendar, Reports and Ask AI already work in a first form.
> Next is Phase 3: hall bookings with the Temple Rules, two-way Google Calendar, and the AI assistant.
> It isn't online yet. Deployment is planned, and we'll put a test version online for the committee to try."

**Who did what (say it as "we"):**
- **Megha:** the original backend and database design (schema, controllers for bookings, calendar, AI and reports), which Phase 3–4 build on, and review of each phase.
- **Venkat:** Phases 1–2 and the screens.
- **Both:** decisions, testing, and the plan below.

---

## 2. Walkthrough: what to show and what to say

Open each screenshot (click it on GitHub) while you talk.

### 2.1 Sign in and joining the team
![Sign in](screenshots/01-sign-in.jpg)
- "One sign-in for everyone. It opens the right app for each person: the admin app for the chairman and committee, the phone app for staff and volunteers."
- "New volunteers, staff and invited committee members sign up themselves (below). Nobody can sign in until the chairman approves them, and the chairman can switch sign-ups off."

![Join the team (phone)](screenshots/18-phone-join.jpg)

### 2.2 Home: the chairman's desk (design H1)
![Home](screenshots/02-home.jpg)
- "Three cards: today's tasks, who's on site, and how much is waiting in the Action Center."
- "**Needs your attention** lists the most urgent things, with one button each: *Remind*, *Assign Harish* (the system picks someone with the right job, preferring people on site), *Sign off*, *Review*."
- "**Today at the mandir** is today's timeline. The next item is highlighted with a countdown."
- "**Plan with AI** and **Broadcast** are at the top, as in the design."

### 2.3 Action Center: everything waiting (design AC1)
![Action Center](screenshots/03-action-center.jpg)
- "One inbox with filters: Approvals, Problems, Overdue. Every row has one main action, and finished items move to 'Done today'."

### 2.4 Tasks (designs T1–T5)
![Tasks](screenshots/04-tasks.jpg)
- "Today, Upcoming, All. Grouped into **Needs attention**, **Awaiting review** and **To do**."
- "Tasks go to a person or a whole job (all cleaners). They can repeat daily or weekly, or have **no deadline** ('any time')."

![New task](screenshots/05-new-task.jpg)
- "Creating a task: who, when, repeat, priority. **Safety task** means a second person must check it."

![Review a finished task](screenshots/06-task-review.jpg)
- "A safety task that's done waits for a second check. The reviewer can **Approve work**, or **Send back with a note**, which goes to the person's phone."

### 2.5 Calendar (designs C1, C3)
![Calendar](screenshots/07-calendar.jpg)
![Day opened](screenshots/08-calendar-day.jpg)
- "Month view; click a day to open it. **Google Calendar two-way sync comes in Phase 3.** For now it shows the temple's tasks."

### 2.6 People and sign-ups (designs P1, P2, P5)
![People](screenshots/09-people.jpg)
- "Everyone, with today's attendance next to each name ('On site · 08:10', 'Not in yet')."

![Person details](screenshots/10-person-details.jpg)
- "Each person: details, last 7 days of attendance, and today's tasks."

![New sign-ups](screenshots/11-new-signups.jpg)
- "New sign-ups: **Approve**, or **Not now** with a reason that is emailed to them."

### 2.7 Broadcast (design H3)
![Broadcast](screenshots/12-broadcast.jpg)
- "One message to all staff, volunteers, a job (all priests) or the committee. **Urgent** ones show in red at the top of their phone."

### 2.8 Ask AI (design AI1)
![Ask AI](screenshots/13-ask-ai.jpg)
- "On every page (⌘K). Today it answers the common questions from live data: who attended this week, who's on site, what isn't done, which safety checks are waiting, what problems are open."
- "**In Phase 3 it becomes Temple AI (Claude)**: it can answer anything, plan festivals from last year, and draft tasks. It only uses what that person is allowed to see."

### 2.9 Reports (designs R1, R2)
![Reports](screenshots/14-reports.jpg)
- "A weekly report written from the records: tasks done, attendance, issues, and what needs attention. Copy as email, or download as PDF."

![Activity log](screenshots/15-activity-log.jpg)
- "Every change, with who made it, kept for accountability."

### 2.10 The phones
![Staff phone](screenshots/16-phone-staff.jpg)
- "**Staff phone** (priests, cooks, cleaners, volunteers): tap **I'm here** when they arrive and their tasks unlock. Big **Done** buttons. *Can't do this?* sends a problem to the chairman."
- "Leaving: if they're the last one out, they must confirm **lamps off, gas off, doors locked**, or the chairman is told."

![Rao garu's phone](screenshots/17-phone-chairman.jpg)
- "**Rao garu's phone**: the same admin app on a phone shows just 'Needs you', one button per card. Tasks, Calendar, People and Reports stay on the temple computer."

---

## 3. What comes next (the plan)

| Phase | What | Notes |
|---|---|---|
| **3, next** | Hall bookings with the **Temple Rules** checklist (M7, AC2, AC4), **Google Calendar two-way sync**, **Temple AI (Claude)** for Ask AI and Plan with AI | Needs: which Google account owns the calendar; a Claude API key |
| **4** | Nightly AI report emailed to the committee; festival-day Home (Ekadashi, Diwali); committee access per area (Off/View/Manage); sign-up window link and QR code; phone screens M3/M4 (task opened, I need help) | |
| **5** | Testing with the committee, fixes, **deployment** (online), release 1.0 | See section 5 |

**How we work from here:** we build each phase with Claude Code from clear, written instructions, read and understand the code together, then test every screen before showing it. Each phase gets its own notes in `docs/phases/`.

---

## 4. Questions to ask (and how to answer theirs)

**Ask Rao garu and the committee:**
1. Should changing someone's access, and the settings, stay with the chairman only?
2. On the phone, is "Needs you" enough, or should "Today at the temple" be there too?
3. Does a new volunteer get the app straight away, or after an induction?
4. Public hall requests: a website form, or does the office enter them?
5. Festival reminders: on Home, in the Action Center, or both?
6. Which Google account should own the temple calendar?
7. Is the faded temple in the background OK?
8. **At the end: ask for a progress update on the certification.**

**If they ask…**
- **"Can we see the code?"** It's all on GitHub, on the `present-today` branch. Good files to open:
  - Screens: `frontend/src/pages/admin/AdminHome.tsx`, `frontend/src/pages/staff/StaffHome.tsx`
  - Server: `backend/controllers/taskController.js`, `backend/controllers/attendanceController.js`
  - Database: `backend/database/migrations/`
- **"Is it live? Can we try it?"** "Not online yet. It runs on our laptops. The next step is a test version online (section 5) so the committee can try it on their phones."
- **"Is it secure?"**
  - Passwords are stored encrypted (hashed).
  - Every request checks who you are and what you're allowed to do.
  - Only approved people can sign in, and the chairman can switch anyone off.
  - Every change is in the activity log.
- **"What does it cost to run?"**
  - The test version can run on free tiers (database, server, website).
  - Real use costs a small monthly amount for hosting, plus Claude usage for the AI in Phase 3.
  - We'll give exact numbers before going live.
- **"When will it be finished?"** "Phase by phase. Each phase ends with something the committee can try. Phase 3 is next."

---

## 5. Running it and putting it online

### 5.1 Run it on a laptop (what we do today)
Full steps for Windows are in [HANDOVER.md, section 2](HANDOVER.md). In short:
```bash
git clone https://github.com/vkom5600/Temple_AI.git
cd Temple_AI && git checkout present-today
# Backend
cd backend && copy .env.example .env      # set DB_PASSWORD and JWT_SECRET
npm install && npm run db:reset          # creates the tables and demo data
npm run dev                              # API on http://localhost:5000
# Frontend (second terminal)
cd frontend && copy .env.example .env && npm install && npm run dev
# open the address it prints, e.g. http://localhost:5173
```

Demo accounts (password is `DEMO_PASSWORD` in `backend/.env`; the sign-in page has a button for each):

| Account | Role |
|---|---|
| raghu@temple.demo | Chairman |
| meena@temple.demo | Committee |
| ramesh@temple.demo | Cleaner |
| anil@temple.demo | Priest |
| priya@temple.demo | Volunteer |

### 5.2 Put a test version online (the plan, not done yet)
Three free-tier services, about an hour the first time:

| Part | Service (free tier) | What to set |
|---|---|---|
| **Database** | Neon or Supabase (PostgreSQL) | Create a database and copy its connection URL |
| **Server (API)** | Render or Railway (Node web service), root folder `backend` | Build `npm install`, start `npm start`. Environment: `DATABASE_URL` (from Neon), `DB_SSL=true`, `JWT_SECRET` (long random text), `NODE_ENV=production`, `TEMPLE_TIMEZONE=Europe/London`, `FRONTEND_URL` (the website address below), and later `SMTP_*` for real emails |
| **Website** | Vercel or Netlify, root folder `frontend` | Build `npm run build`, output `dist`. Environment: `VITE_API_URL` = the server's address (e.g. `https://temple-ai-api.onrender.com`) |

Steps:
1. Create the database on Neon and copy the URL.
2. Create the Render web service from the GitHub repo (branch `present-today`) and add the environment values.
3. In Render's shell, run `npm run db:migrate` once, and `npm run db:seed` if you want the demo accounts on the test version.
4. Create the Vercel site from the same repo with `VITE_API_URL` set, then copy its address into `FRONTEND_URL` on Render and restart it.
5. Open the website address on a phone and sign in.

Before real use:
- Real accounts, and a new chairman password (`npm run create-admin`).
- Email (SMTP).
- A proper domain name.
- Backups of the database.

---

## 6. Where everything is

| What | Where |
|---|---|
| This script and the screenshots | `docs/PRESENTATION.md`, `docs/screenshots/` |
| Status of every designed page | `docs/PROGRESS-REPORT.md` |
| How it works, how to run it, the decisions log | `docs/HANDOVER.md` |
| Notes for each phase | `docs/phases/` |
| Front-end code | `frontend/src/` (pages, components, styles) |
| Server code | `backend/` (routes, controllers, services, jobs) |
| Database | `backend/database/migrations/` (001–004) |
