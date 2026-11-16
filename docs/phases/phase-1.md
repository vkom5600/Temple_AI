# Phase 1 – Foundation

**Branch:** `phase-1` · **Date:** 16 Nov 2026 · **Built by:** Venkat with Claude Code

Full detail (decisions, data model, API, testing, handover): [phase-1-report.md](phase-1-report.md)

## Done when (from the plan)

- [x] Each role logs in and lands on the right home screen (chairman/committee → `/admin`, staff/volunteer → `/staff`)
- [x] Only the chairman can add people (API returns 403 for everyone else; the UI hides the controls)
- [x] Both of us can run the app locally (see README)

Also added from the design docs (User Login activity diagram, User Registration and User Login sequence diagrams):

- [x] Self-registration at `/register`. Accounts start **pending**.
- [x] Chairman approves or rejects (a reason is required) from a Registrations queue on People. The reviewer and date are saved.
- [x] Login shows separate messages for pending, rejected (with the reason) and deactivated accounts.
- [x] Emails: registration received, new-registration alert to the chairman, approved, rejected, and on login a notice to the user plus an alert to the chairman (the alert can be switched off in Settings).
- [x] Settings page (chairman): open/close registration ("Manage Registration Window"), login alert on/off.

## Decisions taken (16 Nov)

| Question | Decision |
|---|---|
| Job roles (priest, cook…) | `users.role` = access (4 roles); `staff_profiles.designation` = job |
| Sign-in | Email + password for everyone |
| Prototype pages not built yet | Hidden; moved to `frontend/src/prototype/` and ported in their phase |
| Language | Frontend TypeScript (as the architecture doc says); backend stays JavaScript |
| Registration | Applicant picks the role (volunteer/staff+job/committee); the chairman approves or rejects it |
| Public / Pilgrim role | Not added. Outside people join as **volunteers** (to be confirmed) |
| Email | nodemailer. Console output when `SMTP_HOST` is empty |
| Login alert to chairman | Sent as designed, with a Settings switch to turn it off |

## Database (`backend/database/migrations/001_foundation.sql`)

| Table | Notes |
|---|---|
| `users` | + `phone`, `approval_status` (pending/approved/rejected), `reviewed_by`, `reviewed_at`, `rejection_reason`, `updated_at` |
| `staff_profiles` | `designation`, `emergency_contact`, `joining_date` (one row per user) |
| `notifications` | + `notification_type` |
| `audit_logs` | `actor_id`, `action`, `entity_type`, `entity_id`, `details` JSONB |
| `settings` | `registration_open`, `login_alert_to_chairman` |

All times are `TIMESTAMPTZ`. Mega's full draft schema moved to `database/reference/schema_draft.sql`, to be used when building later phases.

## API

| Method & path | Who | What |
|---|---|---|
| `GET /api/health` | anyone | API + DB check |
| `GET /api/auth/registration-status` | anyone | `{ open }` |
| `POST /api/auth/register` | anyone | Pending account; notifies and emails the chairman |
| `POST /api/auth/login` | anyone | JWT + user; `code` = `ACCOUNT_PENDING` / `ACCOUNT_REJECTED` / `ACCOUNT_INACTIVE` on 403 |
| `GET /api/auth/profile` | signed in | Current user |
| `GET /api/users[?status=]` | chairman, committee | Everyone (or pending/approved/rejected) |
| `GET /api/users/:id` | chairman, committee | One person |
| `POST /api/users` | chairman | Add a person (approved immediately) |
| `PUT /api/users/:id` | chairman | Edit (full replace); `password` resets it |
| `PATCH /api/users/:id/approve` | chairman | Approve a pending/rejected registration |
| `PATCH /api/users/:id/reject` | chairman | Reject with `{ reason }` |
| `PATCH /api/users/:id/deactivate` / `activate` | chairman | Switch an account off/on |
| `GET /api/notifications`, `/unread-count` | signed in | Own notifications |
| `PATCH /api/notifications/:id/read`, `/read-all` | signed in | Mark read |
| `DELETE /api/notifications/:id` | signed in | Delete own |
| `GET /api/settings`, `PUT /api/settings/:key` | chairman | Read/change switches |

Login and registration are rate-limited (10 tries per 15 minutes per IP + email).

## Shared helpers (use these in every later module)

- `logAudit({ actorId, action, entityType, entityId, details })`, in `services/auditService.js`
- `notify({ userId | userIds | roles | designations, title, message, type })`, in `services/notificationService.js`
- `sendEmail({ to, subject, text })` + templates, in `services/emailService.js` and `emailTemplates.js`
- `getSetting(key)`, in `services/settingsService.js`
- `authenticateToken`, `authorizeRoles(...)`, `ADMIN_ROLES`, in `middleware/authMiddleware.js`

Mega's old names (`createAuditLog`, `sendNotificationSafely`, `notifyRolesSafely`) still work.

## Frontend (`frontend/src/`)

| Screen | Route | Who |
|---|---|---|
| Sign in | `/login` | everyone (demo account shortcuts in dev) |
| Register | `/register` | everyone |
| Admin home (team counts, registrations waiting) | `/admin` | chairman, committee |
| People (+ Registrations queue for the chairman) | `/admin/people` | chairman edits, committee views |
| Settings | `/admin/settings` | chairman |
| Staff home (greeting, latest updates) | `/staff` | staff, volunteer |
| Notification bell | in both layouts | everyone |

## Differences from the designs (worth knowing)

- **Login emails are sent by the server inside `/auth/login`**, not by a second "trigger login notification" call from the frontend as the sequence diagram shows. Same result, one less request, and it can't be skipped.
- The chairman doesn't get a login alert for their own sign-ins.
- The separate Chairman and Committee dashboards in the activity diagram share one admin layout; the differences are in what each can do (e.g. only the chairman sees Settings and the edit controls).

## Notes for later phases

- Routes for tasks, attendance, bookings, calendar, AI, audit and reports are written (Mega's draft) but **commented out in `server.js`** until their migration exists. `aiRoutes`, `calendarRoutes`, `reportRoutes` and `dailyReportJob` currently **crash on import without `ANTHROPIC_API_KEY` / Google keys**. Phase 3 needs the "fallback when no key" change before they're mounted.
- Mega's task controller uses statuses that don't match the prototype (to do / awaiting / verified / flagged). Reconcile them in Phase 2.
- No "change my own password" screen yet. The chairman can reset passwords from People.
- macOS: port 5000 is taken by AirPlay Receiver, so use 5001 locally (README).

## How it was tested

- API: every endpoint above, as each role, including 400/401/403/404/409 cases and the audit rows written.
- Browser: signed in as each role; added a person; registered a new volunteer; saw the pending message; approved and rejected registrations as the chairman; toggled settings; checked the bell count, mark-read and role redirects. No console errors.
