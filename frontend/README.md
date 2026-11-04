# VHP Ilford Temple – Operations frontend (prototype)

React + Vite frontend for the temple management system. All data is mock data held in memory
(`src/data.js`); every action goes through one reducer (`src/store.jsx`), so wiring up the
Node/PostgreSQL backend later means replacing each action with an API call.

## Run

```bash
npm install
npm run dev            # local dev server
npm run build          # normal production build -> dist/
npm run build:single   # one self-contained index.html -> dist-single/ (for sharing a preview)
```

## Who sees what

| Person picked on login | Screen |
|---|---|
| Staff (priest, cook, cleaner, caretaker, security, maintenance) | Mobile checklist: message from chairman, tick tasks, "Can't do this?", "Report a problem" |
| Volunteer | Same, plus a **Sign-offs** tab to verify safety tasks |
| Chairman / Committee | Dashboard, Tasks, Issues, Sign-offs, Bookings, People, Assistant |

## Structure

```
src/
  data.js          mock users, roles, areas, tasks, bookings, issues, sample rules, templates
  store.jsx        state + reducer (one place for all actions)
  lib.js           date formatting, task helpers, booking -> prep task generation, summary
  assistant.js     placeholder "AI" (answers only from rules/notes/task data)
  ui.jsx           shared components (Icon, Badge, Modal, …)
  screens/         Login, StaffHome, ProblemSheet, VerifyList
  admin/           AdminShell, Dashboard, Tasks, TaskForm, Issues, Bookings, People, Assistant
```

## Decisions taken from the client call (29/10)

- Tasks assigned to a **role** (anyone on duty sees it) or a specific person.
- Only chairman/committee create tasks; staff complete, comment or flag.
- Critical tasks (locking, gas off) need a **second person** to sign off; you can't sign off your own.
- Flagged problems become tasks for the right role in one click (suggested assignee).
- Bookings auto-generate preparation tasks, reviewed before assigning.
- Overdue items come with a drafted reminder ready to send.
- Assistant refuses to guess when the temple's own data doesn't cover the question.

## Not built yet

Real login (PIN per person on the shared tablet), backend/API, email/SMS/browser notifications,
Google Calendar + SharePoint integration, real LLM, recurring task generation, reports, inventory.
