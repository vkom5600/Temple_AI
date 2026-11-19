# Temple AI: current work (19 Nov 2026)

The honest, detailed picture of where the project is: what's done, what's left, what's
blocked on other people, and what we'd improve. Written to be read cold by Megha, the
committee, or anyone picking this up.

**Branches:** `feature/bookings` is the full working app and what we submit from.
`current-work` (this branch) is the same code plus these notes. `present-today` and
`main` are older (Phase 1–2 only) and have not been updated.

**Quick numbers**

| | |
|---|---|
| Pages in the site map | 47 |
| Built and working on real data | 44 |
| Partly built | 2 (G3 Settings, M10 After leaving) |
| Not started | 1 (M12 Language) |
| Automated API tests | 26 (`cd backend && npm test`) |
| Screen layout checks | 113 (`cd frontend && npm run check:layout`) |
| Database migrations | 18 (`backend/database/migrations`) |

---

## 1. How to run it

```
git checkout current-work        (or feature/bookings)
cd backend  && npm install && npm run db:migrate && npm run db:seed && npm run dev
cd frontend && npm install && npm run dev
```

Demo logins, all with password `Temple@1234`: **raghu@temple.demo** (chairman),
**meena@temple.demo** and **suresh@temple.demo** (committee), **anil@temple.demo**
(priest), **ramesh@temple.demo** (cleaner), **priya@temple.demo** (volunteer),
**dev@temple.demo** (security). Anita and Mohan are pending sign-ups for the review screen.

Each laptop has its own database, so accounts made on one machine don't exist on another.
After pulling, always run `npm run db:migrate`.

---

## 2. What is done

### Everyone
- Sign in, one login opens the right app for each role (admin on a computer, staff on a phone).
- **Times are always UK time** (GMT/BST), whatever the device's time zone.
- Notifications: admin in the account menu with a dot on the avatar; staff via a bell with a count.

### Chairman and committee (admin web app)
- **Home:** today's tasks, attendance, bookings; "Needs your attention" with one-click actions;
  "Today at the mandir" timeline; festival-day banner; "Coming up"; the 6-weeks-before festival
  planning reminder (Plan it / Later / Not this year).
- **Action Center:** overdue tasks, reported problems, safety sign-offs, booking requests
  (with a rule check and, with a Claude key, a short AI note), staff questions with an Answer
  box, new sign-ups; "Done today" items open to show what happened.
- **Tasks:** Today / Upcoming / All; one-off, no-deadline and repeating tasks; safety tasks
  needing a second person; send back; photos; click anywhere on a row; Remind (manual, and
  automatic hourly 7am–9pm, max 3).
- **Calendar:** Month, Week and Allocation (every hall and room by hour); bookings, temple
  events, waiting requests, tasks and festivals; add bookings and events; Spaces; Festivals list;
  event details with task progress.
- **People:** staff, volunteers and committee with today's attendance; add, edit, switch off,
  remove (history kept); message a person; remind everyone not in yet; keyholder, shift pattern,
  notes; the **sign-up window** (who can sign up, open/close dates, share link, printable QR);
  review new sign-ups with what they chose; **committee access per area** (Off / View / Manage).
- **Temple Rules:** grouped rules, "asked when booking", upload from a document.
- **Reports:** daily/weekly/monthly, nightly report (written by Claude when connected), activity log.
- **Broadcast** to everyone or chosen groups; **Ask AI** and **Plan with AI** (two separate tools).
- **Plan with AI:** chat → tick-box job suggestions → editable draft plan → Confirm creates a
  temple event and its tasks and tells the people assigned; starts from last year's plan for a
  repeat event.

### Staff and volunteers (phone)
- Check in/out with the closing checklist and last-person lock-up.
- Today's tasks: Start, Done, I need help; photos; reminders and messages from the committee.
- Ask a question and see the answer; report a problem; request a booking; my bookings.
- Festival name on festival days; today at the temple.

### Public (no sign-in)
- **Join the temple team** (`/join`): only open groups, closes by itself, mobile and the Temple
  Rules required, availability and areas of help.
- **Book a hall or room** (`/book`): same form as the phone request; rules must be ticked;
  reference number; rate-limited.

### Behind the scenes
- Every request checks sign-in, role and committee access; every change goes in the activity log.
- Scheduled jobs: repeating tasks, closing check, hourly overdue reminders, nightly report.
- **Claude (Temple AI)** is wired into Ask AI, Plan with AI, the booking note and the nightly
  report, and **falls back to built-in answers** with no key, a wrong key, a refusal or an outage.
- One-service hosting (`render.yaml`, `docs/DEPLOY.md`), release notes, handover notes.
- Old unused AI draft files removed.

---

## 3. What is left

### Needs a decision or something from other people (we can't do these alone)

| Item | Who / what | Why it matters |
|---|---|---|
| **Claude API key** | Committee decides who pays and which model (default `claude-opus-5-5`, Sonnet is cheaper) | The Claude paths are built and the fallback is tested, but **real Claude answers have never been tested** |
| **Phone languages (M12)** | Committee picks languages; speakers check translations | The only page not started |
| **Temple timings in Settings (G3)** | Committee: opening, closing, aarti times | The "Today at the mandir" timeline uses tasks and bookings, not fixed timings |
| **Festival dates** | Priest confirms each year | Seeded dates are marked "date to confirm" and are not verified |
| **Other 4 resource names** | Committee (the notes say 10 in all, 6 named) | Bookings can't be made for unnamed spaces |
| **Google Calendar sync** | Google Cloud keys from the temple | Code exists but is switched off; the Calendar page says "not connected" |
| **SMS / WhatsApp broadcasts** | A provider account and a budget | Broadcasts are in-app only |
| **Real email** | SMTP account (Gmail, Microsoft 365, Brevo) | Emails are only logged; also needed for "Send new login link" |
| **Hosting** | Who owns and pays (Render ≈ £15/month) | Needed to go live, see `docs/DEPLOY.md` |
| **Merge to `main`, tag v1.0.0** | Committee agrees it's ready | `main` and `present-today` are still Phase 1–2 |

### Small things we could build
- **M10 After leaving:** only "I'm back" works.
- **"Send new login link"** in a person's details (needs real email first).
- An **AI chat history** icon in Plan with AI (in the design, not built).
- **Phone view of the Calendar week** is stacked; a swipeable day view would be nicer.

---

## 4. Improvements to consider

**Quality and safety**
- Add automated **browser tests** that click through key flows (sign in, create a task, approve a
  booking). Today we have API tests and a layout check, but no end-to-end test.
- Test the **real Claude** responses with a key, tune the prompts, and watch cost per request.
- **Database backups** and a tested restore, before real data goes in.
- Move login rate-limiting to a shared store if we ever run more than one server.
- Stricter password rules and a "forgot password" flow (not built; today the chairman resets).
- A **privacy note** for volunteer sign-ups (we collect name, mobile, email).

**Performance and polish**
- The website downloads as one 547 KB file (153 KB zipped). Split it so each page loads on demand.
- Photos are stored in the database. If there are many, move them to file storage (S3, Cloudflare R2).
- Lazy-load images and cache the festival, spaces and rules lists.

**Viewing sizes and accessibility** (the screen sizes people use)
- Every screen is checked at **desktop, tablet and phone** sizes (`check:layout`), but the staff
  app is designed phone-first and the admin app desktop-first. Worth a pass with the committee
  on their real devices, including a small phone (320px wide) and a large tablet.
- Check keyboard use and screen readers (labels are in place on most controls, not audited).
- Check contrast on the saffron-on-navy badges and the faded temple watermark.
- Large text and "reduce motion" settings.

**Product ideas**
- Push notifications on phones (PWA install) so reminders arrive when the app is closed.
- Offline check-in for patchy signal at the temple.
- Printable weekly rota and a bookings PDF for the committee meeting.
- Volunteer hours report for gift-aid and thank-you letters.
- Show the festival calendar to the public on the join page.

---

## 5. Known issues and caveats
- Real Claude answers are **untested** (no key yet).
- Seeded festival dates are **not verified**.
- Demo data was created on India time; the app now shows UK time, so some demo times look early.
  A fresh `npm run db:reset` on a UK-time machine fixes it.
- The old `frontend/src/prototype/` folder is unused and can be deleted.
- Google Calendar code is written but has **never run** against Google.
- Email is logged only until SMTP is set up.
- `main` and `present-today` are behind. Anyone downloading those get the old version.

---

## 6. Where things live

| What | Where |
|---|---|
| Handover (decisions 1–40, how it all fits) | `docs/HANDOVER.md` |
| Page-by-page status | `docs/PROGRESS-REPORT.md` |
| Release notes (draft) | `docs/RELEASE-NOTES.md` |
| Going live | `docs/DEPLOY.md` and `render.yaml` |
| Presentation script | `docs/PRESENTATION.md` |
| Standards | `docs/STANDARDS.md` |
| Screens | `docs/screenshots/` (older; screens changed since) |
| API tests | `backend/tests/api.test.js` |
| Layout check | `frontend/scripts/layout-check.mjs` |
