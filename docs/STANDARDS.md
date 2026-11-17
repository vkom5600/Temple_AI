# Coding standards (draft – agree before Phase 2)

Short on purpose. Whoever writes the code (Mega, Venkat or Claude) follows these, so every module looks the same.

## Naming

| Thing | Style | Example |
|---|---|---|
| Database tables | snake_case, plural | `staff_profiles`, `task_comments` |
| Database columns | snake_case | `assigned_to`, `created_at` |
| JS/TS variables and functions | camelCase | `logAudit`, `unreadCount` |
| React components and their files | PascalCase | `PeoplePage.tsx`, `NotificationBell.tsx` |
| Other frontend files | camelCase | `client.ts`, `format.ts` |
| Backend files | camelCase + type suffix | `taskController.js`, `taskRoutes.js`, `auditService.js` |
| API routes | `/api/<module>` plural, kebab-case | `GET /api/tasks/:id`, `PATCH /api/tasks/:id/complete` |
| Constants | UPPER_SNAKE_CASE | `ADMIN_ROLES`, `POLL_MS` |
| Audit actions | `<entity>.<past tense>` | `user.created`, `task.completed` |

API JSON uses the database names (snake_case: `full_name`, `is_active`). The frontend uses those field names as-is rather than converting them.

## Roles

- Only users with `approval_status = 'approved'` and `is_active = true` can sign in or receive notifications. Self-registered people start as `pending`.
- `users.role` is **access**: `chairman`, `committee`, `staff`, `volunteer`. It decides what someone may do.
- `staff_profiles.designation` is **job**: `priest`, `cook`, `cleaner`, `caretaker`, `security`, `maintenance` (staff only). Use it to send a task to "all cleaners".
- Admins are chairman + committee (`ADMIN_ROLES`). Only the chairman manages people.

## Tasks (Phase 2)

- Task statuses are exactly: `todo`, `awaiting_signoff`, `done`, `flagged`, `cancelled`. Don't invent others; add a migration and update `StatusBadge` if one is ever needed.
- A task goes to **one** of `assigned_to` (a person) or `assigned_group` (a job, `staff`, `volunteer` or `committee`).
- Use `notifyAssignees(task, …)` from `services/taskService.js` to reach whoever a task is for.
- Use `TIMEZONE` (from `TEMPLE_TIMEZONE`) for anything "today"; never the server's own clock zone.

## Backend (Node + Express, JavaScript ES modules)

```
backend/
  server.js            mounts routes; nothing else
  config/              env loading, database pool
  database/migrations/ 001_foundation.sql, 002_..., applied in order
  middleware/          auth, rate limit, errors
  routes/              one file per module: URL -> controller, plus role checks
  controllers/         one file per module: validate input, query, respond
  services/            shared logic used by several modules (audit, notifications, AI)
  jobs/                scheduled jobs (node-cron)
  scripts/             db, seed, one-off admin scripts
```

- **One routes file and one controller file per module.**
- Protect routes in the routes file: `router.use(authenticateToken)`, then `authorizeRoles("chairman")` per route.
- **Responses** always have the same shape:
  - success: `{ success: true, message?, <data> }`, e.g. `{ success: true, users: [...] }`
  - error: `{ success: false, message: "Plain English the user can read" }`
- **Status codes:** 200 ok, 201 created, 400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 duplicate, 429 too many requests, 500 our fault.
- `PUT` replaces the whole record (send every field). `PATCH /:id/<action>` is for a single action (`/deactivate`, `/complete`).
- Always use parameterised SQL (`$1, $2`). Never build SQL from strings.
- Express 5 passes thrown/async errors to `errorMiddleware.js`, so there's no need for try/catch everywhere. Only catch an error you can turn into a better message (e.g. `23505` becomes "already exists").
- Every change that matters calls **`logAudit()`**. Every "someone should know" moment calls **`notify()`**. Both live in `services/` and never throw.

```js
await logAudit({ actorId: req.user.id, action: "task.completed", entityType: "task", entityId: task.id, details: { note } });
await notify({ designations: ["cleaner"], title: "New task", message: task.title, type: "task" });
```

- Emails go through **`sendEmail({ to, subject, text })`** (`services/emailService.js`). The wording lives in `services/emailTemplates.js`. Without SMTP settings, emails print to the terminal. Never `await` an email in a way that makes the user wait or fail; use the `inBackground` pattern in `authController.js`.
- Chairman switches live in the `settings` table. Read them with `getSetting(key)`; add new keys to `SETTING_KEYS` in `services/settingsService.js`.
- Multi-step writes go in a transaction (`pool.connect()`, `BEGIN`/`COMMIT`/`ROLLBACK`).

## Database

- Changes go in a **new** numbered migration (`002_tasks_issues.sql`). Never edit a migration that's already merged; add another one.
- Ids are `SERIAL` (integers in JS). Times are `TIMESTAMPTZ`. Tables have `created_at`; editable tables also have `updated_at` (via the `set_updated_at()` trigger).
- Use `CHECK` constraints for fixed lists (status, role) and `REFERENCES` for every foreign key.
- `backend/database/reference/schema_draft.sql` is the original full draft. Use it as a starting point for later phases, not as something to run.

## Frontend (React + TypeScript, strict)

```
frontend/src/
  api/          client.ts (fetch + token) and endpoints.ts. The only place that calls the backend
  auth/         AuthContext (who is logged in), RequireRole (route guard)
  components/   shared UI: ui.tsx (Icon, Modal, Avatar…), NotificationBell, Toast
  layouts/      AdminLayout (chairman/committee), StaffLayout (staff/volunteer, mobile)
  pages/        one file per screen: admin/, staff/
  lib/          small pure helpers (formatting)
  types.ts      API shapes
  constants.ts  labels for roles and jobs
  prototype/    the original mock-data prototype. Reference only, not compiled
```

- Function components and hooks only. Keep state local unless two pages need it.
- Call the API only through `src/api/endpoints.ts`. Show the server's `message` on error.
- Reuse classes from `styles.css` before adding new ones. New CSS goes at the bottom under a comment naming the phase.
- `npm run typecheck` must pass before you push.
- Porting a prototype page: copy it from `src/prototype/`, convert to `.tsx`, and swap the mock store for API calls.

## Git

- `main` always runs. Work on a branch: `phase-1`, `feature/tasks`, `feature/attendance`, `fix/<thing>`.
- The other person reviews before merge.
- Commit messages are short and imperative: `Add people page`, `Fix bell count after mark-all`.
- Never commit `.env`, `node_modules/`, `dist/`, or tokens. Only the `.env.example` files are committed.
- Line endings are normalised to LF by `.gitattributes` (Windows and Mac both fine).

## Adding a new module (checklist)

1. Migration `database/migrations/00N_<module>.sql`.
2. `routes/<module>Routes.js` + `controllers/<module>Controller.js`, mounted in `server.js`.
3. `logAudit()` on every change, `notify()` where someone needs to know.
4. Add the endpoint functions in `frontend/src/api/endpoints.ts` and types in `types.ts`.
5. Page(s) in `frontend/src/pages/…`, route in `App.tsx`, nav item in the layout.
6. Test as every role. Write `docs/phases/phase-N.md`.

## Later (not v1.0)

- Backend in TypeScript.
- Automated tests (API tests with a throwaway database).
