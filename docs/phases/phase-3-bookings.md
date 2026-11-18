# Phase 3 – Bookings, Temple Rules and allocation

| | |
|---|---|
| **Branch** | `feature/bookings` (built on `present-today`) |
| **Date** | 19 November 2026 |
| **Built by** | Venkat, using Claude Code. Originally Megha's half of Phase 3 (bookings + calendar), so please review it, Megha |
| **For** | Megha, Rohit and the lead |
| **Designs** | M7, M13, AC1, AC2, AC4, C1, C3, C4 (Stitch). The allocation view comes from the committee's notes on 19 Nov |

---

## 1. Summary

**Two ways to book (committee's notes):**
- **Mobile:**
  - Staff and volunteers request a hall or room on their phone (**M7**).
  - They must tick every Temple Rule before *Send request* unlocks.
  - They get a reference and "Waiting for approval" (**M13**), and can follow or cancel it under **My bookings**.
- **Desk / tablet:**
  - The chairman or committee books straight from the computer or tablet (**C4 "Add to calendar"**). It is confirmed at once.
  - It can be a **Booking** (someone hires a space) or a **Temple event** (the temple runs it).
  - It shows live whether the space is free.

**Approving requests:**
- Requests appear in the **Action Center** and on Home ("Needs your attention"), and on Rao garu's phone.
- Each shows a line like *"Fits all 6 rules · no clashes"* or *"Recommend decline · ends after 21:00"*.
- **Review (AC2)** shows:
  - The requester, date and time, food, and guests.
  - The Temple Rules they agreed ("6 of 6").
  - The recommendation, and the **prep tasks** that approval adds.
- Approving **adds 3–4 prep tasks**: the puja for the priest (if it's a puja), clean and prepare for the cleaner, set up for the caretaker, and check and lock up for security (needs a second check).
- The person who asked gets a message: approved, or rejected with a reason. Any committee member can also *Ask a question*.

**Temple Rules and spaces:**
- **Temple Rules (AC4)** are grouped (Bookings & halls, Stalls & vendors, Kitchen & spaces). Admins add, edit and switch rules off, and mark which ones people must agree to when booking.
- The rule check (rule-based until the AI is connected) looks for clashes, capacity, the finishing time (21:00 weekdays, 22:00 weekends), and all rules agreed.

**Allocation ("one view – allocation"):**
- **Calendar → Allocation:** every hall and room down the side, the day's hours across.
- Shows confirmed, waiting and temple events.
- Tap an empty slot to book it; tap a booking to review it.
- **Halls & rooms** (chairman) adds and renames the spaces.

**Calendar month (C1):** now shows bookings, temple events and waiting requests (tasks optional). **Day opened (C3)** lists the day's bookings and tasks, with "See allocation".

**Home:**
- The **Bookings** card (H1 design): today's count, the next booking, and requests waiting.
- **"Today at the mandir"** shows today's bookings, with "happening now".
- **Staff phones** show "Today at the temple".

## 2. Decisions

| Question | Decision |
|---|---|
| Who books? | Staff and volunteers **request** (needs approval). Chairman and committee **book directly** (confirmed). Public web form (W1) still to decide by the committee |
| Spaces | A `resources` table the chairman manages. Starts with the 6 in the designs: Main Mandir, Shivaji Hall (120), Community Hall (80), Room G37 (25), Room G38 (20), Kitchen. **The committee said 10 in all (6+2+1+1): add the other 4 under Calendar → Allocation → Halls & rooms** |
| Clashes | A confirmed booking blocks the same space and time (checked in a database lock, so two people can't take the same slot). Waiting requests can overlap; approving the second one is refused |
| Rules | One `temple_rules` table. `ask_requester` = on the phone checklist. The rest are for the committee and, later, the AI |
| Recommendation | Rule-based now (clash, capacity, finishing time, rules agreed). Phase 3b: Temple AI (Claude) reads the full written rules |
| Google Calendar | Not connected yet (needs the temple's Google OAuth keys). Bookings live in our database; a `google_event_id` column is ready for the sync |
| Megha's draft `bookingController.js` | Replaced: it used a free-text resource name and the old schema. It's in git history |

## 3. Database

**Migration `005_bookings.sql`:**
- `resources` (name, kind hall/room/mandir/kitchen/space/other, capacity, notes, active, order).
- `temple_rules` (category, text, ask_requester, active, order, updated_by).
- `bookings` with:
  - **What, where, when:** resource, kind booking/event, title, starts/ends.
  - **Details:** guests, food, contact name/phone/email, organisation, notes, deposit_paid.
  - **Status:** pending / approved / declined / cancelled.
  - **Source:** mobile / desk.
  - **Approval:** requested_by, rules_agreed (ids) + time, reviewed_by/at, decision_note, google_event_id.
- `tasks.booking_id`: the prep tasks a booking created.

**Migration `006_booking_defaults.sql`:** the 6 starting spaces and 12 rules from the designs.

## 4. API

| Method & path | Who | What |
|---|---|---|
| `GET /api/resources` | everyone | Active halls and rooms (`?all=1` for admins) |
| `POST /api/resources`, `PUT /api/resources/:id` | chairman | Add or edit a space |
| `GET /api/rules` | everyone | Temple Rules (`?all=1` includes switched-off rules, admins) |
| `POST /api/rules`, `PUT /api/rules/:id` | admins | Add or edit; `is_active:false` switches a rule off |
| `GET /api/bookings?from&to&status` | admins: all; others: their own | |
| `GET /api/bookings/schedule?date` | everyone | Confirmed bookings and events that day |
| `POST /api/bookings/check` | everyone | Is the space free? (clashes, problems) |
| `POST /api/bookings` | everyone | Staff/volunteers: request (all rules required). Admins: confirmed booking/event; `notify_staff` adds the prep tasks |
| `GET /api/bookings/:id` | admins, or the requester | Admins also get `check`, `prep_tasks` and `tasks` |
| `PATCH /api/bookings/:id/approve` | admins | `{ create_tasks }`. Refused if it now clashes |
| `PATCH /api/bookings/:id/decline` | admins | `{ reason }` required; sent to them |
| `POST /api/bookings/:id/ask` | admins | A question to the requester's phone |
| `PATCH /api/bookings/:id/cancel` | requester or admin | Also cancels prep tasks not done yet |

- **Notifications:**
  - A request notifies the chairman and committee, and emails the chairman.
  - Approve, decline and cancel notify the requester (and email `contact_email` if given).
- **Audit actions:** `booking.requested`, `booking.created`, `booking.approved`, `booking.declined`, `booking.cancelled`, `booking.question`, `resource.created`, `resource.updated`, `rule.created`, `rule.updated`.
- **Summary:** `pending_bookings` added (the Action Center badge counts it).

## 5. Screens

| ID | Screen | File |
|---|---|---|
| M7 | Request a booking (phone) | `pages/staff/BookPage.tsx` |
| M13 | Request sent + My bookings | `pages/staff/MyBookingsPage.tsx` |
| AC1 / H1 | Booking rows (Decline / Approve) | `components/InboxRow.tsx`, `lib/inbox.ts` |
| AC2 | Booking review | `components/bookings/BookingReview.tsx` |
| AC4 | Temple Rules | `pages/admin/RulesPage.tsx` |
| C1 / C3 / Allocation | Calendar | `pages/admin/CalendarPage.tsx` |
| C4 | Add to calendar (desk/tablet) | `components/bookings/BookingForm.tsx` |
| – | Halls & rooms | `components/bookings/ResourcesDialog.tsx` |
| H1 | Bookings card, today's bookings | `pages/admin/AdminHome.tsx` |
| AC1 phone | Hall booking card | `pages/admin/PhoneNeedsYou.tsx` |

Screenshots: `docs/screenshots/19-…24-…`.

## 6. How it was tested

- **API (curl):**
  - A request without the rules → 400. With all 6 → pending.
  - The admin check → "Approve · no clashes, all rules agreed" plus the prep tasks list. A volunteer approving → 403.
  - A desk booking in the same slot → confirmed. Approving the earlier request → 409 (clash). A second desk booking → 409.
  - Decline without a reason → 400; with a reason → declined.
  - The birthday puja approved → 4 prep tasks. The stall ending 23:00 → "Recommend decline · ends after 21:00".
  - A volunteer sees only their own requests. The schedule for today and the free/busy check both work.
- **Browser (headless Chrome):**
  - A volunteer filled in M7, ticked all 6 rules, sent → M13 with "6 of 6" and the reference.
  - The request then appeared in the Action Center with "Fits all 6 rules · no clashes".
  - Screenshots of AC2, C4, AC4, the allocation view and both phone screens were compared with the designs.
- Typecheck and production build pass.

## 7. Known issues / next

- **Times show in the device's time zone.** At the temple (UK) that's right. From India, UK bookings look shifted (a 17:00 booking shows as 22:30). Fix: show temple time everywhere (an app-wide change; planned).
- **Google Calendar sync** needs the temple's Google Cloud OAuth client (ID and secret). Then the sync can be switched on and `google_event_id` filled.
- **Not built yet:**
  - Repeating bookings (weekly/monthly in C4).
  - "Paste a message and AI fills the form" (C4).
  - The public form (W1).
  - Upload rules document (AC4).
- **Phase 3b:** Temple AI (Claude) for Ask AI, Plan with AI and the booking recommendation (needs an Anthropic API key).
