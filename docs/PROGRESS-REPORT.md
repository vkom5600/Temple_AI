# Temple AI – Progress report (17 November 2026)

| | |
|---|---|
| **Project** | Temple AI Operations and Management System, Ilford Hindu Centre · Vishwa Hindu Parishad (UK) |
| **Team** | Venkat, Megha, Rohit |
| **Branch with everything** | `present-today` (same as `feature/ui-design`) |
| **Design followed** | *Temple AI · Front-end final review* (11 Nov) and the Stitch screens in `updated-wireframes/screens/` |
| **For** | The team, Pardha garu, Rao garu and the committee |

---

## 1. Summary

- **Phase 0 (setup), Phase 1 (sign-in, people, roles) and Phase 2 (tasks, problems, attendance) are built and working end to end** on a real database, for all four roles.
- **The screens now follow the Stitch designs**:
  - Indigo sidebar with the VHP logo, saffron and green accents.
  - Pages built: H1 Home, AC1 Action Center, T1–T5 Tasks, P1/P2/P5 People, M1/M2/M8 staff phone, and the W2/W3-style sign-up and sign-in.
  - A faded temple (gopuram) sits in the background of every page.
- **Calendar, Reports and Ask AI are in the menu as placeholders.** Each shows what it will do. They are built in Phase 3 (Google Calendar, AI) and Phase 4 (reports).
- **Nothing is deployed yet.** Hosting is part of Phase 5.

| Phase | What | Status |
|---|---|---|
| 0 | Repo, standards, `.env.example`, demo accounts for all roles | ✅ Done |
| 1 | Sign in, roles, people, self-registration with chairman approval, notifications, audit log | ✅ Done |
| 2 | Tasks (assign, repeat, sign-off), problems/issues, attendance (check in/out, last-person lock-up) | ✅ Done |
| Design | Screens rebuilt to the Stitch designs | ✅ Done for every Phase 1–2 page |
| 3 | Bookings + Google Calendar, Temple Rules, AI assistant | ⏳ Next |
| 4 | Reports, broadcasts, activity log, festival reminders, wiring it together | ⏳ After 3 |
| 5 | Testing, clean-up, deployment, release | ⏳ Last |

---

## 2. What each screen does now (by page ID)

### Admin web app (chairman and committee)

| ID | Page | Built | Notes |
|---|---|---|---|
| **H1** | Home | ✅ | "Namaste, Raghu", date, status pill, **Plan with AI** and **Broadcast** (as designed). Three cards: **Today's tasks** (done, awaiting review, overdue), **Attendance** (on site, who isn't in yet), **Action Center** (how much is waiting). **Needs your attention** (top 4 with one-click buttons and a tip on what to do first). **Today at the mandir** (today's timeline, a line for "now", the next item highlighted with a countdown). |
| **AC1** | Action Center | ✅ | Everything waiting, filters **All / Approvals / Problems / Overdue**. Rows: overdue tasks (**Remind**, **Reassign**), reported problems (**Assign Harish** gives it straight to the right person, **Mark fixed**), safety sign-offs (**Review**, **Sign off**), sign-ups (**Review** opens P5). **Done today** list at the bottom. |
| AC2–AC4 | Booking review, All clear, Temple Rules | ◻ Phase 3 | Need bookings. AC3 "All clear" already shows when nothing is waiting. |
| **T1** | Tasks: Today | ✅ | Tabs **Today / Upcoming / All**, search, Person and Role filters, "x of y done today" bar. Sections **Needs attention** (overdue, couldn't do), **Awaiting review**, **To do**. "Show N completed tasks". |
| **T2** | Tasks: Upcoming and All | ✅ | Upcoming list; All as a table. |
| **T3** | New task | ✅ | Two columns, as designed, including **No deadline**: *The essentials* (what, details, **A person / A role**, who it will be sent to, a workload suggestion) and *Options* (deadline date and time, Repeat None/Daily/Weekly, Priority Normal/High, Safety task, where, category). Templates for common jobs. Button says who gets notified ("Create & notify Ramesh"). |
| **T4** | Task details and edit | ✅ | Opens as a side panel. Brief (the instructions shown in a yellow quote box), assigned to/by, deadline, repeat, place, priority, safety. History timeline and comments. **Delete task**, **Send reminder**, **Edit task**. |
| **T5** | Review a finished task | ✅ | Same panel: the **submission** (on time or late, with the person's note), **What needs fixing?**, **Send back with note** / **Approve work**. |
| T6, T7 | Flagged task, Needs help | ✅ partly | "Couldn't do" tasks show in Needs attention and the issue goes to the Action Center. "I need help" (M4) is Phase 4. |
| **C1** | Calendar: Month | ✅ (tasks for now) | As designed: month arrows, Today, filters, Month/Week, today in a saffron circle. Entries are the temple's tasks until **Google Calendar sync in Phase 3** (agreed). |
| **C3** | Day opened | ✅ | Click a day: everything on it with time, place, person and status; **+ Add on [date]**; *Open in Google Calendar* switches on in Phase 3. C2 Week and C5 Event details are still to design. |
| **P1** | People | ✅ | "x of y on site" bar with who isn't in yet; search; role filter; one table grouped **Staff / Volunteers / Committee** with phone, email and today's status (*On site · 08:10*, *Left*, *Not in yet*, *Absent*). |
| **P2** | Person details | ✅ | Name, status pill, job, **Staff / Volunteer / Committee** switch, phone, email, emergency contact, joined, password reset; **Active** bar with switch off; **Last 7 days** attendance dots; **Today's tasks**. |
| P3 | Add person | ✅ | Same form, empty. |
| P4 | Sign-up window | ✅ partly | The **Sign-ups Open/Closed** switch is on People. Dates, link and QR code are Phase 4. |
| **P5** | Check new sign-ups | ✅ | Side panel, one card per person: when they signed up, phone, email, **Joining as** (with a warning for committee), **Approve** / **Not now** (with a reason that is emailed to them). |
| **R1** | Reports: Summary | ✅ | Daily / Weekly / Monthly report written from the records: tasks done (with change on last period), attendance, issues, what needs attention. **Copy as email**, **Download PDF**. Phase 4 swaps in the AI-written nightly version. |
| **R2** | Activity log | ✅ | Every change in plain sentences ("Raghu approved 'Kitchen deep clean'"), grouped by day, filter and search, Load older. |
| **AI1** | Ask AI | ✅ preview | Side panel on every page (⌘K), also *Plan with AI* on Home. Answers the common questions from live data (who attended this week, as a table; who's on site; what's not done; safety checks; open problems). **Temple AI (Claude) is Phase 3.** |
| AI2 | Plan with AI | ◻ Phase 3 | |
| **H3** | Broadcast | ✅ | Everyone / All staff / All volunteers / Committee, or chosen jobs; "Will reach N people · on duty now"; 280 characters; **Mark as urgent**. Staff see it at the top of their phone with **Got it** (M2). |
| H2 | Festival-day Home | ◻ Phase 4 | |
| G1 | Sign in | ✅ | Built in the W2 style (indigo bar with the logo). |
| G2, G3 | Account menu, Settings | ✅ | Account menu at the bottom of the sidebar: Attendance records, Issue history, Settings (chairman), Sign out. |

### Staff phone app (staff, priests, volunteers)

| ID | Page | Built | Notes |
|---|---|---|---|
| **M1** | Arriving | ✅ | Indigo day card (date, greeting, tasks done, next time), "Not checked in yet", the big green **I'm here** button. Tasks are **locked until they tap I'm here**, as designed. |
| **M2** | Your tasks today | ✅ | **Message from Raghu** card (Got it). "You arrived at 2:25 PM · **Undo**" (10 minutes). Tasks with no deadline show as **Any time**. Task cards with coloured edges (red late, saffron safety, green done) and a **Done** button. "Can't do this?", **Coming up**, **Report a problem**, **I'm leaving**, Sign out at the bottom. Volunteers also see **Safety checks** to sign off. |
| M3, M4 | Task opened, I need help | ◻ Phase 4 | Today "Done" works straight from the card. |
| M5 | Report a problem | ✅ | Built in Phase 2 (sheet); restyle to the new look when M5 is designed. |
| M7, M13 | Book a hall, Request sent | ◻ Phase 3 | Needs bookings + Temple Rules. |
| **M8** | I'm leaving | ✅ | "Leave now?" lists any tasks not done, **Yes, I'm leaving** / **No, stay**. If they're the **last one out**, they must tick lamps, gas and doors; leaving without ticking tells the chairman (app + email). |
| M9–M12 | Last one out, After leaving, Safety checks, Language | ✅ partly | Last-one-out and safety checks work (above). Language is not started. |

### Rao garu's phone

| ID | Page | Built | Notes |
|---|---|---|---|
| **AC1 (phone)** | Needs you | ✅ | On a phone, the chairman/committee app opens "N things need you": on site, tasks done, overdue; one button per card (Remind, Sign off, Assign Harish, Review); Done today; Broadcast and Ask AI. |
| AC2 (phone) | Review a booking | ◻ Phase 3 | Needs bookings. |

### Public pages

| ID | Page | Built | Notes |
|---|---|---|---|
| **W2** | Join the temple team | ✅ | Choice cards Volunteer / Staff / Committee member ("only if the chairman asked you"), job for staff, name, phone, email, password. Only open while sign-ups are switched on. |
| **W3** | Thank you / Sign-ups closed | ✅ | Both states. |
| W1 | Hall request form | ◻ Phase 3 | Still to decide: website form or office enters it. |

---

## 3. How it all connects (the workflow)

1. **One sign-in, the right app.** Chairman and committee land on H1 Home; staff, priests and volunteers on the phone app. New people register (W2) and wait for the chairman (P5).
2. **Staff arrive and tap I'm here (M1).** Their tasks unlock. Attendance shows up on Home and People straight away.
3. **They tick tasks Done (M2).** Ordinary tasks close. **Safety tasks** wait for a second person (a volunteer or committee member; never the person who did it): they appear on Home, in the Action Center and under **Awaiting review** in Tasks; the reviewer **Approves** or **Sends back with a note** (T5).
4. **Problems** ("Can't do this?" or "Report a problem") land in the **Action Center**. One click gives the job to the right person ("Assign Harish"), or **Mark fixed**.
5. **Overdue tasks** show on Home and the Action Center with **Remind** (app notification + email) and **Reassign**.
6. **Leaving (M8).** The last person out confirms lamps, gas and doors. An evening check at the closing time (Settings, default 21:00) tells the chairman if anyone is still checked in or nobody locked up.
7. **Repeating tasks** (daily/weekly) are created automatically; every action is written to the audit log.

---

## 4. Decisions made this week

| Decision | Why |
|---|---|
| Follow the Stitch design system: indigo, saffron and green from the VHP logo and website; Inter font | It is the agreed design; colours come from the temple's own identity |
| VHP logo in the sidebar, phone top bar and sign-in | Required |
| A faded gopuram behind every page and faint mandala circles in the staff day card | Adds a temple feel without changing the clean design. Easy to remove (one setting) if the committee prefers |
| Calendar, Reports and Ask AI in the menu now, as placeholders | The menu matches the design; each page says which phase fills it |
| Calendar will be **Google Calendar** (two-way sync) in Phase 3 | Agreed with Venkat |
| Tasks lock until "I'm here" on the phone | As in M1 |
| "Assign Harish" picks someone with the right job, preferring people on site | As in AC1/H1; rule-based now, AI later |
| Suggestions ("✦ …") are rule-based until the AI assistant | Useful now; Phase 3 swaps in Temple AI |

Earlier decisions (roles, sign-off rules, repeating tasks, attendance) are in `docs/HANDOVER.md` section 6.

---

## 5. What is left, and who picks it up

**Phase 3, next:**
- **Bookings and Temple Rules:** M7, M13, AC2, AC4, W1.
- **Google Calendar sync:** C1/C3 (built, showing tasks for now) get events, festivals and bookings; C4 Add to calendar.
- **Ask AI and Plan with AI:** AI1, AI2.

**Phase 4:**
- **Broadcast (H3)** and "Message from Raghu" on phones.
- **Festival Home (H2)**.
- **Reports R1/R2:** the nightly report, and the activity log page.
- **Sign-up window details (P4):** dates, link, QR.
- **Phone screens:** M3 Task opened, M4 I need help, Language (M12).
- **Committee access per area** (Off / View / Manage, from P2/P3).

**Phase 5:** automated tests, deployment (database + API + website hosting), release 1.0.

**Back end with Megha** (from the design pack):
- Access per person (Off/View/Manage per area), checked on every request.
- Sign-up window (who can join, dates, link).
- Bookings with the rules agreed and the prep tasks drafted on approval.
- AI answers only from areas the person can see.

---

## 6. Questions for Rao garu and the committee

1. Should changing someone's access, and the settings, stay with the chairman only?
2. On the phone, is "Needs you" enough, or should "Today at the temple" be there too?
3. Does a new volunteer get the app straight away, or after an induction?
4. Public hall requests: a website form (W1), or does the office enter them?
5. Festival reminders: on Home, in the Action Center, or both?
6. Priests' screen: what was agreed for the M2 rework?
7. Is the faded temple in the background OK, or should it be removed?
8. Which Google account should own the temple calendar?

---

## 7. How to see it

```bash
git clone https://github.com/vkom5600/Temple_AI.git
cd Temple_AI && git checkout present-today
# then follow docs/HANDOVER.md section 2 (database, backend, frontend)
```

Demo accounts (password is `DEMO_PASSWORD` in `backend/.env`):

| Account | Role |
|---|---|
| raghu@temple.demo | Chairman |
| meena@temple.demo | Committee |
| ramesh@temple.demo | Staff (cleaner) |
| priya@temple.demo | Volunteer |

The sign-in page has buttons for each account in development.

**Checked before pushing:**
- Typecheck and production build pass.
- Every screen above was screenshotted at desktop (1440 px) and phone (390 px) width and compared with the design PNGs.
- The one-click actions (Remind, Create task, Approve) were clicked in a real browser against the real API.
