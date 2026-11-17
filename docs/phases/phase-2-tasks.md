# Phase 2 – Tasks + Issues

| | |
|---|---|
| **Branch** | `feature/tasks` (from `phase-1`) |
| **Date** | 17 November 2026 |
| **Built by** | Venkat, using Claude Code |
| **Part of Phase 2** | Tasks + Issues (Venkat). Attendance is Mega's, on `feature/attendance`. |
| **For** | Mega (review), Rohit and the lead |

---

## 1. Summary

The chairman and committee can now run the temple's daily work:

- **Create tasks** for one person or a whole group ("all cleaners", "volunteers"), several at once, from templates, and as **daily or weekly repeats**.
- **Staff tick tasks off** on their phone, can **undo**, and can say **"Can't do this?"** (which opens an issue).
- **Safety tasks** (locking up, gas off) need a **second person to sign off**. Volunteers, committee or chairman can sign off, **never the person who did it**, and they can **send a task back** with what's wrong.
- **Anyone can report a problem.** Admins **resolve** it (which puts a blocked task back on the list) or **turn it into a task** (with a suggested title and person).
- Admins can **remind** people (bell + email), **reopen**, **cancel** (and stop a repeat), **edit / reassign**, and see **overdue** tasks at a glance.
- Every action writes to the **audit log** and tells the right people through **notifications**.

Plan "done when": *both modules work end to end for every role and write audit and notification entries.* **Met for Tasks + Issues.** (Attendance is Mega's part.)

---

## 2. Decisions (asked before building)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Verify every task (activity diagram) or only safety tasks (prototype + plan)? | **Safety tasks only.** Normal tasks: To do → Done. Safety: To do → Waiting for sign-off → Done, or **sent back** (the diagram's "rework"). | The chairman shouldn't have to approve every sweep and bin. |
| 2 | Who may sign off? | **Volunteers, committee, chairman**, never the person who did it. | As in the prototype. Enforced by the API and a database CHECK. |
| 3 | Task for a whole group: shared or one copy each? | **One shared task.** Whoever in the group does it, it's done for all. | Works with shifts and cover. |
| 4 | Repeating tasks: now or later? | **Now (Phase 2).** | Without it the chairman re-creates the daily routine every day. |

Smaller choices made while building:

- **Task statuses** (one list, replacing the three different ones in the prototype, Mega's draft and the activity diagram): `todo`, `awaiting_signoff`, `done`, `flagged` (couldn't do), `cancelled`.
- **Groups** a task can go to: any staff job (`priest`, `cook`, `cleaner`, `caretaker`, `security`, `maintenance`), `staff` (all staff), `volunteer`, `committee`.
- **"Bulk create"** means one form with several assignees, which creates a separate task for each. The API also accepts up to 50 tasks in one request (useful for Phase 4's "booking → prep tasks").
- **Resolving an issue** that blocked a task puts that task back to "to do", with a note ("Problem sorted… please try again"). **Converting** an issue leaves the original task as "couldn't do", so the admin can reopen or cancel it.
- **Reminders** go to the bell and by email, at most once every 5 minutes per task.
- **Undo** is allowed for the person who ticked the task (or an admin) until it's signed off.
- **Times:** "today", overdue and repeats use the temple's time zone (`TEMPLE_TIMEZONE`, default `Europe/London`). Repeats keep the same clock time when the clocks change.
- **Mega's draft task code** (create/list/submit/verify, one assignee) was **replaced**; her draft schema stays in `database/reference/` for history.

---

## 3. Database – `migrations/002_tasks_issues.sql`

### tasks

| Column | Notes |
|---|---|
| title, description, category, area | description is shown as "Notes"; category and area are free text (the UI offers lists) |
| assigned_to **or** assigned_group | exactly one (CHECK) |
| priority | `low` / `normal` / `high` |
| requires_verification | true = safety task, needs sign-off |
| status | `todo` / `awaiting_signoff` / `done` / `flagged` / `cancelled` |
| due_at | TIMESTAMPTZ |
| recurrence, series_id | `none` / `daily` / `weekly`; every copy of a repeating task shares `series_id` (the first copy's id) |
| completed_by / completed_at, verified_by / verified_at | **CHECK: verified_by ≠ completed_by** |
| last_reminded_at, reminder_count | |
| created_by, created_at, updated_at | |

A unique index on `(series_id, due_at)` stops the repeat job ever creating the same copy twice.

### task_comments

`task_id`, `user_id`, `comment`, `comment_type` (`comment`, `sent_back`, `flagged`, `system`). This is the task's history: the staff card shows the latest sent-back or "problem sorted" note.

### issues

`reported_by`, `task_id` (when it came from "Can't do this?"), `category` (Something is broken / Supplies missing / Not enough time / Other), `description`, `status` (`open` / `resolved` / `converted`), `resolved_by`, `resolved_at`, `resolution_note`, `created_task_id`.

---

## 4. How repeating tasks work

1. When a task is saved with "Every day" or "Every week", it becomes the first copy of a **series** (`series_id = its id`).
2. `jobs/repeatingTasksJob.js` runs **when the server starts and every 15 minutes**. For each series it looks at the **latest** copy. If a day (or week) has passed in temple time, it creates **one** new copy at the same clock time.
3. If the server was off for several days, it creates only today's copy, not a backlog of overdue ones.
4. **Stopping a repeat:** edit the task to "One time only", or "Cancel and stop repeating". Either one switches off the whole series.
5. Cancelling just one day ("Cancel this one") leaves the series running.
6. Tested: a daily task last due 2 days ago gets exactly one copy, for today. A weekly task gets one a week later. A second run creates nothing. The time stays 09:00 London across the 25 Oct clock change.

---

## 5. API

All routes need sign-in. *Admins* = chairman + committee. *Signers* = volunteer + committee + chairman.

### Tasks (`/api/tasks`)

| Method & path | Who | What |
|---|---|---|
| `GET /` | everyone | Admins: `?view=open\|overdue\|signoff\|flagged\|done\|all` (+ `group`, `category`). Others: **their own** tasks (today, overdue, next 7 days, done today). |
| `GET /summary` | admins | today_total, today_done, overdue, awaiting_signoff, flagged, open_issues |
| `GET /signoffs` | signers | Safety tasks waiting to be checked |
| `GET /:id` | admins, the assignee, or a signer while it awaits sign-off | Task + full comment history |
| `POST /` | admins | One task, or `{ tasks: [...] }` (up to 50); notifies the assignees |
| `PUT /:id` | admins | Edit / reassign (full replace); notifies new assignees; changing the repeat applies to the whole series |
| `PATCH /:id/complete` | assignee or admin | `{ note? }` → done, or awaiting sign-off (notifies signers, except the doer) |
| `PATCH /:id/undo` | whoever ticked it, or admin | Before sign-off only |
| `PATCH /:id/verify` | signers, not the doer | → done; notifies the doer |
| `PATCH /:id/send-back` | signers, not the doer | `{ note }` required → back to to-do; notifies the doer |
| `PATCH /:id/flag` | assignee or admin | `{ category, description }` → "couldn't do" + opens an issue; notifies admins |
| `PATCH /:id/reopen` | admins | Any status → to-do |
| `PATCH /:id/cancel` | admins | `{ stop_repeating? }` |
| `POST /:id/remind` | admins | Bell + email to the assignees; at most every 5 minutes |
| `POST /:id/comments` | assignee, admin, signer | `{ comment }`; tells the admin who created the task when staff comment |

### Issues (`/api/issues`)

| Method & path | Who | What |
|---|---|---|
| `POST /` | everyone | `{ category, description }`, a general "Report a problem"; notifies admins |
| `GET /?status=open\|handled` | admins | |
| `PATCH /:id/resolve` | admins | `{ note? }`; reopens a blocked task; tells the reporter |
| `POST /:id/convert` | admins | Task body → creates the task, marks the issue converted, tells the reporter and the new assignees |

### Audit actions added

`task.created`, `task.updated`, `task.completed`, `task.undone`, `task.verified`, `task.sent_back`, `task.flagged`, `task.reopened`, `task.cancelled`, `task.reminded`, `task.repeats_created` (system), `issue.reported`, `issue.resolved`, `issue.converted`.

### Shared helpers added (`services/taskService.js`)

`isAssignedTo`, `canWorkOn`, `notifyAssignees` (one person, a job, or a role), `assigneeEmails`, `addComment`, `findTask`, `generateRepeatingTasks`, `TASK_GROUPS`, `SIGNOFF_ROLES`, `TIMEZONE`.

`notify()` gained `excludeUserId`, so the person who caused an event isn't notified about it.

---

## 6. Screens (ported from `src/prototype/`)

| Screen | Who | Notes |
|---|---|---|
| **Admin Home** | admins | New "Today" panel: tasks done today, overdue, waiting for sign-off, open issues, each linking to the right list |
| **Sidebar** | admins | Tasks / Issues / Sign-offs with live counts (refresh on every page change and every minute) |
| **Tasks** | admins | Views (open, overdue, sign-off, couldn't do, done, everything), filter by who and category; red edge on overdue rows; badges for category, repeats, sign-off, high priority, comments. The view is in the URL, so Home can link to "overdue". |
| **New task / Edit** | admins | Templates, several assignees, category (+ "Other"), where, date, time, repeats, priority, "needs a second person to sign off", notes |
| **Task details** | admins | All fields, history and comments, add a comment; sign off / send back; reopen, remind, edit/reassign, cancel (this one, or stop repeating) |
| **Issues** | admins | Open / Handled; suggested task and person from the problem text; "Create task" (pre-filled) or "Mark resolved" (optional note) |
| **Sign-offs** | admins | The same list volunteers see |
| **Staff home** | staff, volunteers | Day hero with "x of y done", progress bar, big tick buttons, overdue in red, safety badge, sent-back note, "Can't do this?", Undo, "Coming up", "Report a problem" |
| **Sign-offs tab** | volunteers | "I checked, sign off" / "Not done" (with reason); your own tasks can't be signed off |

The prototype's charts, dashboard, bookings and assistant are still in `src/prototype/` for later phases.

---

## 7. How it was tested

**API** (curl script, every endpoint, as chairman, committee, cleaner, cook, security, priest and volunteer):

- Staff see only their own and their group's tasks. Another job's task → 404; completing it → 403.
- Validation: no assignee, two assignees, unknown group, invalid view → 400.
- Bulk create of 2 tasks. Shared group task completed by one cleaner. Completing twice → 400. Another person undoing → 403. Undo by the doer works.
- Safety task: done → awaiting sign-off → staff verify → 403 → send back without a note → 400 → send back → the note appears on the doer's card → done again → volunteer signs off → undo after sign-off → 400. A committee member signs off another person's task.
- Can't do → issue opened. Report a problem. Staff listing issues → 403. Resolve reopens the blocked task. Convert creates a task; converting twice → 400.
- Remind → bell + email; again within 5 minutes → 429; reminding a done task → 400.
- Edit into a daily series with a reassign (the new person is notified); cancel + stop repeating; reopen.
- Comments: an assignee can comment, a stranger gets 404, and the task creator is notified.
- The audit rows and notification recipients were checked in the database.

**Repeat job:** daily, weekly, no duplicates, clock change (section 4).

**Browser** (Chrome, real API):

- **Chairman:** Home Today panel and sidebar counts; Tasks list; created one task for Cleaners + Volunteers in one go; opened a couldn't-do task's details; turned the broken-lock issue into a task (pre-filled) and saw it under Handled.
- **Cleaner:** ticked a task; "Can't do this?" with a reason; the card shows the report.
- **Volunteer:** Sign-offs tab; signed off the Community Hall lock-up.
- No console errors. `npm run typecheck` and `npm run build` pass.

---

## 8. Known issues / for later phases

- **Phase 3/4 draft code still uses the old task statuses** (`assigned`, `completed`, `pending_verification`, `approved`, `closed`) and `due_date`: `jobs/overdueReminderJob.js`, `services/reportService.js`, `controllers/aiController.js`. These aren't switched on. Update them when Phase 3/4 mounts them; new list: `todo / awaiting_signoff / done / flagged / cancelled`, and `due_at`.
- **Sign-off alerts go to every volunteer + committee member + the chairman** (about 6 people per safety task). If that's too noisy, limit it to whoever is checked in today once Attendance lands.
- Automatic hourly **overdue reminders** are Phase 4 (the plan's scheduled job). Phase 2 has the manual "Send reminder" and overdue flags.
- **Booking → prep tasks** wiring is Phase 4 (the bulk API is ready for it).
- The "turn into a task" suggestion is simple keyword matching; Phase 3's AI could do better.
- When an issue becomes a task, "Where" defaults to Main Mandir. The admin sets it (issues don't record a place yet).
- Lists return at most 500 tasks; no paging yet.
- Times show in the device's time zone; "today" on the server uses `TEMPLE_TIMEZONE`. Fine while everyone is in the UK.

---

## 9. Files

**Backend:** `database/migrations/002_tasks_issues.sql`, `services/taskService.js`, `utils/taskValidation.js`, `controllers/taskController.js` (rewritten), `controllers/issueController.js`, `routes/taskRoutes.js` (rewritten), `routes/issueRoutes.js`, `jobs/repeatingTasksJob.js`, `services/emailTemplates.js` (+ `taskReminder`), `services/notificationService.js` (+ `excludeUserId`), `scripts/seed.js` (+ demo tasks), `scripts/db.js`, `server.js`, `.env.example` (+ `TEMPLE_TIMEZONE`).

**Frontend:** `types.ts`, `api/endpoints.ts`, `constants.ts`, `lib/format.ts`, `lib/tasks.ts`, `components/ui.tsx` (+ icons), `components/tasks/{StatusBadge,TaskForm,TaskDetails,VerifyList,ProblemSheet}.tsx`, `pages/admin/{TasksPage,IssuesPage,SignoffsPage,AdminHome}.tsx`, `pages/staff/StaffHome.tsx`, `layouts/AdminLayout.tsx`, `App.tsx`, `styles.css`.

---

## 10. Merging with Mega's attendance branch

- Both branches add a migration. **Number them in merge order**: whichever merges second renames its file to `003_...`. Never two `002`s.
- Both touch `server.js` (route lines), `seed.js` and `StaffHome.tsx` (her check-in card goes above "Today"). Expect small, easy conflicts there.
- Her "last person out didn't confirm → notify chairman" can use `notify({ roles: ["chairman"], ... })` as is.
