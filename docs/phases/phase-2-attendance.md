# Phase 2 – Attendance

| | |
|---|---|
| **Branch** | `feature/attendance` (built on top of `feature/tasks`, so merge tasks first) |
| **Date** | 17 November 2026 |
| **Built by** | Venkat, using Claude Code (originally Mega's half of Phase 2, so worth her review) |
| **For** | Mega, Rohit and the lead |

---

## 1. Summary

- **Staff and volunteers** tap **"I'm here"** when they arrive (undo within 10 minutes), **"I'm leaving"** when they go, and **"I'm back"** if they return the same day.
- The **last person on site** must confirm **lamps off, gas off, doors locked**. If they leave without ticking all three, the **chairman is told** (bell + email).
- **Evening check:** after a closing time the chairman sets (default 21:00), if anyone is still checked in, or nobody confirmed the closing checks that day, the chairman is told. It runs once a day and is skipped on days nobody came in.
- **Chairman and committee** don't check in by default. If they're **helping on site**, they tap **"I'm helping today"** on Home and get the same card.
- **Who's On** (admins) shows any day: who's here, who came and left, who's not in, who's absent; **jobs nobody covered**; whether the temple was **locked up properly**. Admins can **mark absent**, **add** a forgotten check-in, **correct** any time, or **remove** a wrong record. The person is notified of any change.
- Staff can see **"My attendance"** for the last 30 days (from the staff and volunteer use cases).

Plan "done when": *works end to end for every role and writes audit and notification entries.* **Met.**

---

## 2. Decisions

| Question | Decision |
|---|---|
| Who checks in? | Staff + volunteers always. **Chairman/committee can opt in** for the day ("I'm helping today"). |
| What if nobody taps "I'm leaving"? | **Evening check** at a closing time in Settings → chairman notified (bell + email). |
| Late arrivals? | **Not tracked**: there's no rota/shift start time yet. Status is `present` or `absent`. |
| Breaks ("I'm leaving" then "I'm back")? | One record per person per day. "I'm back" clears the leaving time. Every step is in the audit log. |
| Closing checklist vs the closing *tasks* from Phase 2 | **Kept separate.** The checklist is about the building at the end of the day; the closing tasks are named jobs with sign-off. They can be joined up in Phase 4. |
| Mega's draft (check-in / check-out / list / mark absent) | **Replaced** with the above. |

---

## 3. Database – `migrations/003_attendance.sql`

**attendance**: one row per person per day (temple time zone):

| Column | Notes |
|---|---|
| user_id, attendance_date | UNIQUE together |
| status | `present` / `absent` (absent rows have no times, CHECK) |
| check_in | first arrival |
| check_out | when they left; NULL while on site |
| closing_checks | `{"lamps": true, "gas": true, "doors": false}` from the last person out |
| closing_confirmed_at / closing_skipped | all ticked, or left without ticking all |
| notes, updated_by | updated_by = themselves, or the admin who corrected it |

CHECK: `check_out ≥ check_in`.

New setting `closing_time` (`21:00`). An internal key, `closing_check_last_date`, stops the evening alert being sent twice.

**Also fixed:** Postgres `DATE` values now come back as plain `YYYY-MM-DD` text (`config/db.js`). Before, the driver turned them into midnight on the *server's* clock, which can shift the day. This also fixes a hidden Phase 1 bug where a person's "Joined" date could show one day early.

---

## 4. API (`/api/attendance`)

| Method & path | Who | What |
|---|---|---|
| `GET /me` | anyone signed in | Today's record, `on_site`, `last_one_here`, `can_undo`, the closing checklist, last 30 days |
| `POST /check-in` | anyone | "I'm here". Already in → 409; left today → 409 "use I'm back"; marked absent → becomes present |
| `POST /undo-check-in` | anyone | Within 10 minutes only |
| `POST /leave` | anyone on site | `{ closing?: { lamps, gas, doors } }`. The server decides if you're last; last + anything unticked → skipped, chairman told |
| `POST /back` | anyone who left today | Clears the leaving time (and any closing confirmation) |
| `GET /?date=YYYY-MM-DD` | admins | Who's On: people + state, counts, job gaps, closing status |
| `PUT /:userId/:date` | admins | `{ status, check_in?, check_out?, notes? }`: mark absent, add or correct; the person is notified |
| `DELETE /:userId/:date` | admins | Remove a wrong record |

Settings: `PUT /api/settings/closing_time` with `{ "value": "HH:MM" }`.

**Audit actions:** `attendance.checked_in`, `attendance.check_in_undone`, `attendance.checked_out` (with closing details when last out), `attendance.returned`, `attendance.marked_absent`, `attendance.added`, `attendance.corrected` (before/after), `attendance.removed`, `attendance.closing_alert` (system).

**Job:** `jobs/closingCheckJob.js`, every 5 minutes; acts once a day after the closing time.

---

## 5. Screens

| Screen | Who | What |
|---|---|---|
| **Check-in card** (under the greeting) | staff, volunteers | "I'm here", then "Here since 9:02 · Undo · I'm leaving", then "Left at 17:10 · locked up · I'm back"; "Marked absent" → "I'm here after all"; "My attendance" history |
| **Leaving sheet** | whoever's leaving | Not last: "Others are still here, so they'll lock up." Last: three big tick boxes; "All done, leave" (only when all ticked) or "Leave without checking" (tells the chairman) |
| **Home: "Helping on site today?"** | chairman, committee | Opt-in check-in; after tapping, the same card |
| **Home: "Who's here"** | admins | Names on site now + jobs with nobody in |
| **Who's on** (new nav item) | admins | Day picker (‹ date ›, Today); counts; Cover (gaps); Closing (locked up / skipped / not yet); table with status, in, out, notes, last change; Mark absent / Add / Edit / Remove |
| **Settings** | chairman | Evening closing check time |

---

## 6. How it was tested

**API** (curl script):

- Check in; again → 409; undo; undo again → 400; leave without being in → 400.
- Leave when others are here (not last); check in after leaving → 409 "use I'm back"; back; back again → 400.
- With everyone else gone: `last_one_here = true`. Leaving with only lamps ticked → skipped, chairman notified + emailed. Back, then leaving with all three → confirmed.
- Staff opening Who's On → 403. The day view gives correct counts, gaps (maintenance, caretaker) and closing.
- Mark absent → the person is notified; they check in anyway → present. Leave-before-arrive → 400; present without a time → 400; bad date → 400; staff correcting → 403. Correcting yesterday → the person is notified. Remove; remove again → 404.
- A committee member opting in appears on Who's On.
- Closing time `9pm` → 400. **Evening check** at 00:00 → alert naming who's still in; a second run → nothing.
- Audit rows and notifications checked in the database.

**Browser** (Chrome, real API):

- **Volunteer:** check in → "Here since…" + Undo. After the others left → last-person checklist → all ticked → "Left at … · locked up", "I'm back".
- **Chairman:** Home "Who's here" + "I'm helping today" → card appears; Who's On shows counts, gaps and "Locked up · Priya…"; marked Jaya absent; added Harish's forgotten 9:00 check-in (his job gap cleared); previous day view; Settings shows the closing time.
- No console errors. Typecheck and build pass.

---

## 7. Known issues / for later

- **Times show in the device's time zone.** For people in the UK that's temple time. For you and Mega testing from India, a 21:10 UK lock-up shows as 2:40 AM. Option for later: always show temple time (a small change in `lib/format.ts`).
- **No rota / shift times**, so no "late" status and no "should have been in" list; gaps are worked out from who has a job at all. A rota could come later (the prototype has one).
- **Sign-off alerts** (from Tasks) could be limited to people checked in today, now that attendance exists. Not done yet.
- The closing checklist doesn't tick off the closing *tasks*. Joining them up is a Phase 4 "wire it together" item.
- The evening check runs once a day. Changing the closing time after it has run that day doesn't run it again until tomorrow.
