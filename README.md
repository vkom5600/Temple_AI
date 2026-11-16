# Temple AI – Operations & Management System

Web app for running the temple day to day: people, tasks, attendance, hall bookings, an AI assistant and daily reports.

| Part | Stack | Folder |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | [frontend/](frontend/) |
| Backend | Node.js + Express 5 (JavaScript, ES modules) | [backend/](backend/) |
| Database | PostgreSQL | [backend/database/migrations/](backend/database/migrations/) |
| Docs | Standards, phase notes | [docs/](docs/) |

**Status:** Phase 1 (foundation): sign in, self-registration with chairman approval, roles, people, notifications, emails, settings, audit log. See [docs/phases/phase-1.md](docs/phases/phase-1.md).

## Run it locally

You need Node 20+ and PostgreSQL 14+.

```bash
# 1. Backend
cd backend
cp .env.example .env          # then edit: DB_USER, DB_PASSWORD, JWT_SECRET (see comments in the file)
npm install
createdb temple_ai            # or create the database in pgAdmin
npm run db:reset              # creates the tables and the demo accounts
npm run dev                   # API on http://localhost:5000

# 2. Frontend (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # app on http://localhost:5173
```

Open the app and sign in with a demo account. Every demo account uses `DEMO_PASSWORD` from `backend/.env` (default `Temple@1234`).

| Role | Email | Lands on |
|---|---|---|
| Chairman | raghu@temple.demo | Admin (can add/edit people) |
| Committee | meena@temple.demo, suresh@temple.demo | Admin (view only for people) |
| Staff | anil (priest), kamla (cook), ramesh (cleaner), jaya (caretaker), dev (security), harish (maintenance) `@temple.demo` | Mobile staff home |
| Volunteer | priya@temple.demo, vikram@temple.demo | Mobile staff home |
| Pending registrations | anita@temple.demo, mohan@temple.demo | Can't sign in until the chairman approves them |

New people can also sign up at `/register`; the chairman approves or rejects them on the People page.

**Emails:** with `SMTP_HOST` empty (the default), every email is printed in the backend terminal instead of being sent. Fill in the SMTP lines in `backend/.env` to send real email.

**Mac users:** macOS uses port 5000 for AirPlay Receiver. Set `PORT=5001` in `backend/.env` and `VITE_API_PROXY_TARGET=http://localhost:5001` in `frontend/.env`.

## Database commands (backend/)

| Command | What it does |
|---|---|
| `npm run db:migrate` | Applies any new files in `database/migrations/`. Run after pulling. |
| `npm run db:seed` | Adds the demo accounts (skips ones that exist). |
| `npm run db:reset` | **Wipes everything**, then migrates and seeds. Development only. |

## Working together

- `main` always works. Each module is built on its own branch (`phase-1`, `feature/tasks`, `feature/attendance`, …) and the other person reviews it before it merges.
- Read [docs/STANDARDS.md](docs/STANDARDS.md) before writing code (naming, API shape, folders).
- At the end of each phase, add `docs/phases/phase-N.md` describing what was built.
