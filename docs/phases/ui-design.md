# Design pass – the Stitch designs, built

| | |
|---|---|
| **Branch** | `feature/ui-design` (built on `phase-2`) |
| **Date** | 17 November 2026 |
| **Design source** | *Temple AI · Front-end final review* (11 Nov) and `updated-wireframes/screens/*.png` (the Stitch export) |
| **Full status by page ID** | `docs/PROGRESS-REPORT.md` |

## What changed

Every Phase 1–2 page was rebuilt to match its Stitch screen:
- **Admin:** H1 Home, AC1 Action Center, T1–T5 Tasks (T4/T5 as a side panel), P1 People, P2 Person details, P5 Check new sign-ups.
- **Staff phone:** M1/M2 and M8 I'm leaving.
- **Sign-in and join:** G1 Sign in, and W2/W3 Join the temple team.
- **Menu:** the full sidebar (Home, Action Center, Tasks, Calendar, People, Reports, Ask AI). C1 Calendar month and C3 Day opened are built (showing tasks until Google Calendar in Phase 3). Reports and Ask AI are placeholders until Phases 3–4.

Earlier on this branch there was a maroon/gold "temple theme" pass. It was replaced by the design system. What it kept: the faded gopuram behind each page, and faint mandala circles in the staff day card.

## Where the look lives

| To change | Edit |
|---|---|
| Colours | `frontend/src/styles.css`, tokens at the top (`--ind-*` indigo, `--saf*` saffron, `--green*`) |
| Component styles | `styles.css`, section "Design system (from the Stitch designs)" and below |
| Temple name, tagline, logo | `frontend/src/branding.ts`, `frontend/public/vhp-logo.png` |
| Faded gopuram | `components/Ornaments.tsx`; strength: `.page-watermark { opacity }` |
| Sidebar menu | `layouts/AdminLayout.tsx` (`NAV`) |

## New code

- **Backend:**
  - `GET /api/tasks?view=today|mine` (admins).
  - `pending_registrations` in `/api/tasks/summary`.
- **Frontend: new**
  - `lib/inbox.ts`: one list of everything waiting, used by Home and the Action Center.
  - `components/InboxRow.tsx`: a row with its one-click actions.
  - `pages/admin/ActionCenterPage.tsx`, `CalendarPage.tsx`, `ReportsPage.tsx`.
  - `pages/admin/Registrations.tsx`: now the Sign-ups card + the P5 panel.
- **Frontend: rewritten to the designs**
  - `AdminHome`, `TasksPage`, `PeoplePage` (table + P2), `StaffHome`, `TaskForm` (T3), `TaskDetails` (T4/T5), `LoginPage`, `RegisterPage`, both layouts.
