# Temple AI 1.0.0: release notes (draft)

The operations app for Ilford Hindu Centre (VHP UK): tasks, attendance, bookings, people,
festivals and reports, for the chairman and committee on a computer and for staff and
volunteers on their phones.

## What's in 1.0.0

**Admin (chairman and committee)**
- **Home:** today's tasks, attendance and bookings; what needs attention, with one-click
  actions; today at the mandir; festival-day banner, "Coming up", and a 6-week planning
  reminder for big festivals.
- **Action Center:** overdue tasks, reported problems, safety sign-offs, booking requests
  (checked against the Temple Rules) and new sign-ups; "Done today".
- **Tasks:** today, upcoming and all; one-off, no-deadline and repeating tasks; safety tasks
  with a second check; send back; reminders (by hand and automatic, hourly in the day).
- **Calendar:** month view with bookings, temple events, tasks and festivals; the allocation
  view of every hall and room; add bookings and events; spaces; festivals list.
- **People:** staff, volunteers and committee with today's attendance; add, edit, switch off,
  remove; the sign-up window with link and printable QR code; committee access per area
  (Off / View / Manage).
- **Temple Rules:** grouped rules, "asked when booking", upload from a document.
- **Reports:** daily, weekly and monthly summaries, the nightly report, and the activity log.
- **Broadcast** to everyone or chosen groups; notifications in the account menu.
- **Ask AI** and **Plan with AI**: built-in answers and planner, or Temple AI (Claude) when an
  API key is added.

**Staff and volunteers (phone)**
- Check in and out, with the closing checklist; today's tasks (Start, Done, I need help);
  reminders on the task card; messages from the chairman; today at the temple;
  request a booking and see my bookings; report a problem.

**Public:** join the temple team (only open groups, closes by itself), booking request form.

**Behind the scenes**
- Every request checks sign-in, role and committee access; all changes go in the activity log.
- Scheduled jobs: repeating tasks, closing check, hourly overdue reminders, nightly report.
- 19 automated API tests (`npm test`) and a 100-screen layout check (`npm run check:layout`).
- One-service hosting (`render.yaml`, see `docs/DEPLOY.md`).

## Not in 1.0.0 (next)

- **Language choice for phones (M12):** needs the committee to choose the languages, and
  native speakers to check the translations.
- **Google Calendar two-way sync:** code is ready; needs the temple's Google keys.
- **SMS / WhatsApp for broadcasts:** in-app only for now (email when SMTP is set up).
- **Times always in UK time:** times show in the device's time zone, which is right in the UK.
- **Festival dates:** need confirming with the priest each year.

## Before tagging

- Merge `feature/bookings` into `main`.
- Run `npm test` (backend) and `npm run check:layout` (frontend).
- Tag `v1.0.0` on `main` and publish these notes as the GitHub release.
