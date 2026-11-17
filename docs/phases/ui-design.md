# Design pass – prototype layout + temple theme

| | |
|---|---|
| **Branch** | `feature/ui-design` (built on `phase-2` / `feature/attendance`) |
| **Date** | 17 November 2026 |
| **Built by** | Venkat, using Claude Code |
| **For** | Mega, Rohit and the lead |

---

## 1. Why

After Phase 2 the real app worked, but it didn't look like the designs:

- The **dashboard** was a simplified page. The prototype's dashboard (`src/prototype/admin/Dashboard.jsx`) has a "Today" panel with a progress ring, chips and lanes, a "Who's on" panel, and "Needs your attention".
- The **name** said "Temple AI" instead of the temple's name, and the first nav item said "Home" instead of "Dashboard".
- Feedback: the look was **a little plain**. Look at the TTD (Tirumala Tirupati) site, and make it more temple-themed, e.g. something faded in the background.

The other pages (Tasks, Issues, Sign-offs, People, staff home) already followed the prototype closely, so they only get the theme.

---

## 2. What changed on screen

| Where | Before | Now |
|---|---|---|
| **Dashboard** (chairman, committee) | Greeting + 4 number tiles + "Who's here" + "The team" | Layout from the prototype, on real data (below) |
| **Sign-in / Register** | Plain page | A temple "gateway" banner (two faded gopurams, a garland on top) with the form card over its edge |
| **Sidebar** | "Temple AI" | Temple name, garland strip on top, maroon + gold highlight on the current page, a gear icon for Settings |
| **Every signed-in page** | — | A large gopuram, very faded, fixed in the bottom-right corner behind the content; a faint kolam dot pattern on the background |
| **Page titles** | — | A small gold bead-and-line ornament under each title |
| **Staff home banner** | Gradient + mandala | + a marigold/mango-leaf garland along the top and a small gopuram in the corner |
| **Browser tab** | No icon | An Om favicon in the theme gradient |

### The dashboard, top to bottom

1. **Temple banner** (the TTD idea): maroon → saffron → gold, garland along the top, a faded gopuram and mandala on the right. "Namaste, Raghu", today's date and temple name, "4 of 14 tasks done today · 4 people on site", and the **New task** and **Who's on** buttons.
2. **Today** (from the prototype):
   - **Ring:** green = done, amber = done but waiting for sign-off.
   - **Headline:** the next task due, or "N tasks from today are late", or "Everything for today is done".
   - **Chips:** overdue, open issues, waiting for sign-off, and registrations to approve (chairman only). Each one opens the right page.
   - **Three lanes:** Daily checks, Safety & closing, and Problems reported. On a phone you swipe between them.
3. **Who's on today**: people checked in now (with arrival time), people who came and left, one red line for jobs nobody has covered, and "N not in yet". It links to the full Who's on page.
4. **Needs your attention**: one-click actions.
   - **Registrations:** a **Review** button (chairman).
   - **Reported problems:** a **Create task** button. It opens the task form already filled in, with a guess at who should do it.
   - **Overdue tasks:**
     - **Remind**, or **Mark done** if the task is your own.
     - After a day overdue the task is highlighted red with a **Reassign** button (opens the task to edit).
     - Shows "not reminded yet" or "reminded 2 times, last 3 hr ago".
5. **Today in brief**: a few plain sentences built from today's records, with **Copy as email**. The Phase 3 AI assistant can write this instead later.
6. **Your follow-ups**: tasks assigned to you (or your role), with a tick box.
7. **Helping on site today?**: the opt-in check-in card for admins, moved here from the top.

Not shown yet, because the features don't exist:
- **Phase 3:** the Events lane / calendar, the request bar, the AI summary.
- **Phase 4:** "Message to all staff" (announcements).

---

## 3. Changing the look later

Everything is in a few places on purpose:

| To change | Edit |
|---|---|
| The temple's name | `frontend/.env` → `VITE_TEMPLE_NAME=...` (no code change), or the default in `frontend/src/branding.ts` |
| Colours | `frontend/src/styles.css`, the tokens at the top: `--maroon`, `--gold`, `--temple` (the banner gradient), `--accent` (buttons) |
| Banners, watermark, garland, ornaments | `styles.css`, the **"Temple theme"** section at the end |
| The gopuram or mandala drawing | `frontend/src/components/Ornaments.tsx` (drawn in code, takes the colour of what it sits on) |
| How faded the background gopuram is | `.page-watermark { opacity: .06 }` in `styles.css` |
| Sign-in / Register banner | `frontend/src/components/EntryShell.tsx` |
| Dashboard sections | `frontend/src/pages/admin/AdminHome.tsx` (one small component per section) |

All artwork is our own drawing; nothing (images, logos) is copied from the TTD site.

---

## 4. Code changes

**Backend** (one small, read-only addition):
- `GET /api/tasks?view=today`: admins, every task due today in temple time. Feeds the ring and lanes.
- `GET /api/tasks?view=mine`: admins, their own open tasks (to them or their role). Feeds "Your follow-ups".
- An unknown `view` still gives a 400 that lists the valid ones.

**Frontend:**

| File | What |
|---|---|
| `branding.ts` | New. Temple name and tagline |
| `components/Ornaments.tsx` | New. `Gopuram`, `Mandala` (moved from StaffHome), `Toran` (garland) |
| `components/EntryShell.tsx` | New. Banner layout for sign-in and registration |
| `components/tasks/ConvertIssueForm.tsx` | New. "Create task from this issue", moved out of IssuesPage so the dashboard can use it too |
| `pages/admin/AdminHome.tsx` | Rewritten as the prototype dashboard |
| `layouts/AdminLayout.tsx`, `StaffLayout.tsx` | Name, garland, watermark, "Dashboard", Settings icon |
| `pages/LoginPage.tsx`, `RegisterPage.tsx`, `staff/StaffHome.tsx` | Theme only. Same fields and behaviour |
| `components/ui.tsx` | `settings` and `copy` icons |
| `styles.css` | Theme tokens + "Temple theme" section |
| `public/favicon.svg`, `index.html` | Favicon |
| `.env.example` | `VITE_TEMPLE_NAME` |

---

## 5. How it was tested

- **API:**
  - Chairman `view=today` gave 14 tasks.
  - `view=mine` gave the chairman's own task.
  - `view=bogus` gave a 400 listing the valid views.
  - Staff still only see their own tasks.
- **Screens** (headless Chrome, real API, demo data):
  - Sign-in, register, dashboard (desktop 1440 px and phone 390 px), tasks, Who's on, staff home (phone).
  - On the phone, nothing is wider than the screen; the lanes swipe.
- **Clicks:**
  - Dashboard **Create task** on a problem opens the pre-filled form ("Buy and restock supplies", Caretaker).
  - **Remind** shows "Reminder sent to 1 person".
- No console errors. Typecheck and production build pass.
