import pool from "../config/db.js";
import { TIMEZONE } from "./taskService.js";
import { findClashes, prepTasksFor } from "./bookingService.js";
import { aiEnabled, askJson } from "./aiService.js";

// AI2 Plan with AI: turns "Navratri garba night, 300 people, Sat 14" into a draft
// plan (a calendar event + the tasks to run it). Rule-based for now, so it never
// makes anything up: it reads the idea, checks the space, clashes and Temple Rules,
// asks for what's missing, and reuses last time's tasks when there was a similar
// event. Temple AI (Claude) can take over the same steps once the key is added.

// ---------------------------------------------------------------- dates in temple time

const parts = (date) => Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
        timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23"
    }).formatToParts(date).map((p) => [p.type, p.value])
);

// A wall-clock time at the temple → a real instant.
const templeTime = (y, m, d, h, min) => {
    const guess = Date.UTC(y, m, d, h, min);
    const offset = (t) => {
        const p = parts(new Date(t));
        return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
    };
    return new Date(guess - offset(guess - offset(guess)));
};

const todayAtTemple = () => {
    const p = parts(new Date());
    return { y: +p.year, m: +p.month - 1, d: +p.day, weekday: WEEKDAYS.indexOf(p.weekday.slice(0, 3).toLowerCase()) };
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_RE = /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thu|fri|sat)\b(?:\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?:am|pm|:|-|–|to\b)))?/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const addDays = ({ y, m, d }, n) => { const t = new Date(Date.UTC(y, m, d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }; };

// "today", "tomorrow", "next Saturday", "Sat 14", "14 Nov", "Nov 14th", "14/11" → a date.
export const parseDay = (text) => {
    const s = text.toLowerCase();
    const today = todayAtTemple();
    if (/\btoday\b|\btonight\b/.test(s)) return today;
    if (/\btomorrow\b/.test(s)) return addDays(today, 1);

    let m = s.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b(?!\s*(?:am|pm))/);
    if (m) {
        const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.y;
        const day = { y, m: +m[2] - 1, d: +m[1] };
        return !m[3] && Date.UTC(day.y, day.m, day.d) < Date.UTC(today.y, today.m, today.d) ? { ...day, y: y + 1 } : day;
    }

    const month = (word) => MONTHS.findIndex((mo) => word.startsWith(mo));
    m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:,?\s+(20\d{2}))?/) ||
        s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(20\d{2}))?/);
    if (m) {
        const [d, mo] = /\d/.test(m[1]) ? [+m[1], month(m[2])] : [+m[2], month(m[1])];
        if (m[3]) return { y: +m[3], m: mo, d };
        const day = { y: today.y, m: mo, d };
        return Date.UTC(day.y, day.m, day.d) < Date.UTC(today.y, today.m, today.d) ? { ...day, y: day.y + 1 } : day;
    }

    const wd = s.match(WEEKDAY_RE);
    if (wd) {
        const target = WEEKDAYS.indexOf(wd[2].slice(0, 3));
        if (wd[3]) {
            // "Sat 14": the next date that is the 14th (this month or next)
            for (let i = 0; i < 62; i++) {
                const day = addDays(today, i);
                if (day.d === +wd[3]) return day;
            }
        }
        let ahead = (target - today.weekday + 7) % 7;
        if (wd[1] && ahead === 0) ahead = 7;
        return addDays(today, ahead);
    }

    m = s.match(/\b(?:on\s+the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:am|pm))/);
    if (m) {
        for (let i = 0; i < 62; i++) { const day = addDays(today, i); if (day.d === +m[1]) return day; }
    }
    return null;
};

// "6-10pm", "18:00 to 22:00", "at 11am", "evening" → { start, end } in minutes after midnight.
export const parseTimes = (text) => {
    const s = text.toLowerCase();
    const toMin = (h, min, ap) => {
        let hour = +h;
        if (ap === "pm" && hour < 12) hour += 12;
        if (ap === "am" && hour === 12) hour = 0;
        return hour * 60 + (+min || 0);
    };
    const range = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (range && (range[3] || range[6] || range[2] || range[5])) {
        const endAp = range[6] ?? (range[3] ?? null);
        const startAp = range[3] ?? (range[6] && +range[1] <= +range[4] ? range[6] : null);
        return { start: toMin(range[1], range[2], startAp), end: toMin(range[4], range[5], endAp) };
    }
    const one = s.match(/\b(?:at|from)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || s.match(/\b(\d{1,2}):(\d{2})\b/);
    if (one) return { start: toMin(one[1], one[2], one[3]) };
    if (/\bmorning\b/.test(s)) return { start: 10 * 60 };
    if (/\bafternoon\b/.test(s)) return { start: 14 * 60 };
    if (/\bevening\b|\bnight\b/.test(s)) return { start: 18 * 60 };
    return null;
};

export const parseGuests = (text) => {
    const m = text.match(/\b(\d{1,4})\s*(?:\+\s*)?(?:people|persons|guests|ppl|devotees|attendees|visitors|families|kids|children|members)\b/i) ||
              text.match(/\bfor\s+(?:about\s+|around\s+)?(\d{1,4})\b(?!\s*(?:am|pm|:))/i) ||
              text.match(/^\s*(?:about\s+|around\s+|roughly\s+)?(\d{1,4})\s*$/);
    return m ? +m[1] : null;
};

// ---------------------------------------------------------------- what kind of event

const KINDS = [
    { key: "festival", test: /(diwali|deepavali|navratri|navaratri|garba|dandiya|holi|janmashtami|ganesh|shivratri|shivaratri|ram navami|hanuman jayanti|sankranti|pongal|onam|durga|festival|celebration|utsav)/i, start: 18 * 60, hours: 4 },
    { key: "puja", test: /(puja|pooja|havan|homam|katha|abhishek|satyanarayan|aarti|archana|vrat)/i, start: 10 * 60, hours: 2 },
    { key: "meal", test: /(dinner|lunch|breakfast|bhojan|langar|bhandara|meal|feast|food)/i, start: 12 * 60 + 30, hours: 3 },
    { key: "class", test: /(yoga|class|bhajan|kirtan|satsang|workshop|lesson|talk|lecture|camp|school)/i, start: 10 * 60, hours: 2 },
    { key: "meeting", test: /(meeting|agm|committee|trustees)/i, start: 19 * 60, hours: 2 },
];
const kindOf = (title) => KINDS.find((k) => k.test.test(title)) ?? { key: "event", start: 18 * 60, hours: 3 };

const cleanTitle = (first) => {
    let t = first.split(/[,;\n]| - /)[0]
        .replace(/\b(for\s+)?(about\s+|around\s+)?\d{1,4}\s*(people|persons|guests|ppl|devotees|attendees)\b/gi, "")
        .replace(/\b(on|this|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thu|fri|sat)\b.*$/i, "")
        .replace(/\b(plan|organise|organize|set up|arrange)\s+(a|an|the)?\s*/i, "")
        .replace(/\s+/g, " ").trim();
    if (t.length < 3) t = "Temple event";
    return t[0].toUpperCase() + t.slice(1);
};

// ---------------------------------------------------------------- the draft

const at = (base, minutes) => new Date(base.getTime() + minutes * 60_000).toISOString();
const STOP = new Set(["the", "and", "for", "with", "night", "day", "evening", "morning", "event", "temple", "celebration", "family", "our", "big", "annual"]);

// The most recent past event with a similar name that had tasks ("Plan from last year").
const findLastTime = async (title) => {
    const words = title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w));
    for (const word of words) {
        const past = (await pool.query(
            `SELECT b.id, b.title, b.starts_at, b.ends_at, b.guests, r.name AS resource_name
             FROM bookings b JOIN resources r ON r.id = b.resource_id
             WHERE b.status = 'approved' AND b.starts_at < NOW() AND b.title ILIKE $1
               AND EXISTS (SELECT 1 FROM tasks t WHERE t.booking_id = b.id AND t.status <> 'cancelled')
             ORDER BY b.starts_at DESC LIMIT 1`,
            [`%${word}%`]
        )).rows[0];
        if (past) {
            const tasks = (await pool.query(
                `SELECT title, category, assigned_to, assigned_group, requires_verification, due_at, u.full_name AS assigned_to_name
                 FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to AND u.is_active
                 WHERE t.booking_id = $1 AND t.status <> 'cancelled' ORDER BY t.due_at NULLS LAST`,
                [past.id]
            )).rows;
            return { ...past, tasks };
        }
    }
    return null;
};

const extrasFor = (kind, { title, place, guests, start, end }) => {
    const t = [];
    let section = "event";
    const add = (title, group, due, category, safety = false) => t.push({ title, assigned_to: null, assigned_group: group, due_at: due, category, requires_verification: safety, section });
    if (kind === "festival") {
        add(`Decorate ${place} (rangoli, diyas, flowers)`, "volunteer", at(start, -180), "Events & bookings");
        add(`Prepare prasad${guests ? ` for ${guests} people` : ""}`, "cook", at(start, -120), "Kitchen");
        add("Check the sound system and lights", "maintenance", at(start, -120), "Maintenance");
        add(`Aarti and puja for ${title}`, "priest", at(start, 30), "Puja & rituals");
        add(`Tell devotees about ${title}`, "committee", at(start, -7 * 24 * 60), "Admin & committee");
    }
    if (kind === "puja") {
        add(`Prepare puja items for ${title}`, "priest", at(start, -45), "Puja & rituals");
        add("Prepare prasad", "cook", at(start, -60), "Kitchen");
    }
    if (kind === "meal") {
        add(`Cook${guests ? ` for ${guests} people` : ""}`, "cook", at(start, -150), "Kitchen");
        add("Serve the food and clear the tables", "volunteer", at(start, 0), "Events & bookings");
        add("Clean the kitchen after the meal", "cleaner", at(end, 30), "Cleaning");
    }
    if (kind === "meeting") {
        add(`Send the agenda for ${title}`, "committee", at(start, -3 * 24 * 60), "Admin & committee");
    }
    if (guests >= 100) {
        section = "crowd";
        add("Direct cars at the gate", "volunteer", at(start, -30), "Events & bookings");
        add("Put out cones and parking signs", "maintenance", at(start, -120), "Maintenance");
        add("Check fire exits and the first aid kit", "security", at(start, -60), "Security & closing", true);
    }
    if (guests >= 150) {
        add("Put up a car-share notice for devotees", "committee", at(start, -5 * 24 * 60), "Admin & committee");
    }
    return t;
};

// With Temple AI connected, Claude reads the idea (any wording, any language of dates);
// without it, the rule-based reader below does. Returns null to use the rules.
const IDEA_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["title", "kind", "guests", "date", "start", "end", "space"],
    properties: {
        title: { type: "string", description: "Short event name, e.g. 'Navratri garba night'" },
        kind: { type: "string", enum: ["festival", "puja", "meal", "class", "meeting", "event"] },
        guests: { type: ["integer", "null"], description: "People expected, or null if not said" },
        date: { type: ["string", "null"], description: "YYYY-MM-DD in temple time, or null if no day was given" },
        start: { type: ["string", "null"], description: "HH:MM 24-hour, or null if not said" },
        end: { type: ["string", "null"], description: "HH:MM 24-hour, or null if not said" },
        space: { type: ["string", "null"], description: "Exact name of a space from the list if one was asked for, else null" },
    },
};

const readIdea = async (said, spaces) => {
    if (!aiEnabled()) return null;
    const p = todayAtTemple();
    const today = `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    const r = await askJson({
        schema: IDEA_SCHEMA,
        system: `You read a temple event idea and fill in the fields. Today is ${DAY_NAMES[p.weekday]} ${today} (temple time, UK). Resolve words like "next Sunday" or "Sat 14" to a real date on or after today. Only fill what the person actually said: use null for anything missing, never guess a date, time or headcount. The spaces are: ${spaces.join(", ")}.`,
        messages: [{ role: "user", content: said.map((m, i) => `${i === 0 ? "Idea" : "Then"}: ${m}`).join("\n") }],
    });
    return r.ok ? r.data : null;
};
const hm = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? ""); return m ? +m[1] * 60 + +m[2] : null; };

// conversation: the user's messages so far. asked: questions already asked (so we don't nag).
export const draftPlan = async ({ messages = [], asked = [] }) => {
    const said = messages.map((m) => String(m).trim()).filter(Boolean);
    if (!said.length) return { reply: "Tell me about the event: what it is, roughly how many people, and the day." };

    const resourceNames = (await pool.query("SELECT name FROM resources WHERE is_active ORDER BY sort_order, name")).rows.map((r) => r.name);
    const ai = await readIdea(said, resourceNames);
    const title = ai?.title?.trim() ? ai.title.trim()[0].toUpperCase() + ai.title.trim().slice(1) : cleanTitle(said[0]);
    const kind = (ai && KINDS.find((k) => k.key === ai.kind)) || kindOf(said.join(" "));
    // Later messages win: look from the newest back
    const pick = (fn) => { for (let i = said.length - 1; i >= 0; i--) { const v = fn(said[i]); if (v !== null && v !== undefined) return v; } return null; };
    const aiDay = ai?.date && /^(\d{4})-(\d{2})-(\d{2})$/.test(ai.date) ? { y: +ai.date.slice(0, 4), m: +ai.date.slice(5, 7) - 1, d: +ai.date.slice(8, 10) } : null;
    const day = aiDay ?? pick(parseDay);
    const aiStart = hm(ai?.start);
    const aiEnd = hm(ai?.end);
    const times = aiStart !== null ? { start: aiStart, end: aiEnd ?? undefined } : pick(parseTimes);
    const guests = Number.isInteger(ai?.guests) ? ai.guests : pick(parseGuests);

    if (!day) {
        return { reply: `${title}: lovely. Which day is it? (For example "Sat 14 Dec" or "next Sunday".)`, ask: "day" };
    }
    if (guests === null && !asked.includes("guests") && kind.key !== "meeting") {
        return { reply: "Roughly how many people are you expecting? I'll use it to pick the right hall and plan parking. (Say \"not sure\" to skip.)", ask: "guests" };
    }

    const startMin = times?.start ?? kind.start;
    const endMin = times?.end && times.end > startMin ? times.end : Math.min(startMin + kind.hours * 60, 23 * 60 + 30);
    const start = templeTime(day.y, day.m, day.d, Math.floor(startMin / 60), startMin % 60);
    const end = templeTime(day.y, day.m, day.d, Math.floor(endMin / 60), endMin % 60);
    const notes = [];
    const saidDay = pick((m) => (parseDay(m) ? (m.toLowerCase().match(WEEKDAY_RE)?.[2] ?? null) : null));
    const actual = new Date(Date.UTC(day.y, day.m, day.d)).getUTCDay();
    if (saidDay && WEEKDAYS.indexOf(saidDay.slice(0, 3)) !== actual) {
        notes.push({ tone: "warn", text: `${day.d} ${MONTHS[day.m][0].toUpperCase()}${MONTHS[day.m].slice(1)} is a ${DAY_NAMES[actual]}, not a ${DAY_NAMES[WEEKDAYS.indexOf(saidDay.slice(0, 3))]}. Check the date.` });
    }
    if (start < new Date()) notes.push({ tone: "warn", text: "That time has already passed. Pick a later day or time before confirming." });

    // The space: the one they named, else the smallest hall that fits everyone.
    const resources = (await pool.query("SELECT * FROM resources WHERE is_active ORDER BY sort_order, name")).rows;
    const all = said.join(" ").toLowerCase();
    const aiSpace = ai?.space ? resources.find((r) => r.name.toLowerCase() === ai.space.toLowerCase()) : null;
    const named = aiSpace ?? resources.find((r) => r.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && w !== "hall" && w !== "room" && all.includes(w)) ||
                                       (r.name.match(/\b[a-z]\d+\b/i) && all.includes(r.name.match(/\b[a-z]\d+\b/i)[0].toLowerCase())));
    const venues = resources.filter((r) => ["hall", "mandir", "space", "room"].includes(r.kind) && r.capacity);
    const biggest = [...venues].sort((a, b) => b.capacity - a.capacity)[0];
    const fits = (r) => !guests || !r.capacity || r.capacity >= guests;
    const freeAt = async (r) => (await findClashes(r.id, start, end)).length === 0;

    let place = named ?? null;
    // A puja goes in the Mandir when it's free and big enough
    if (!place && kind.key === "puja") {
        const mandir = resources.find((r) => r.kind === "mandir");
        if (mandir && fits(mandir) && await freeAt(mandir)) place = mandir;
    }
    if (!place) {
        for (const r of [...venues].sort((a, b) => a.capacity - b.capacity)) {
            if (fits(r) && await freeAt(r)) { place = r; break; }
        }
    }
    place = place ?? biggest ?? resources[0];
    if (!place) return { reply: "There are no halls or rooms set up yet. Add them in Calendar → Spaces first." };

    if (guests && place.capacity && guests > place.capacity) {
        notes.push({ tone: "warn", text: `${place.name} holds ${place.capacity}, so ${guests} won't fit (Temple Rule: stay within capacity). Use the grounds as well, split across two spaces, or keep it smaller.` });
    }
    const clashes = await findClashes(place.id, start, end);
    if (clashes.length) notes.push({ tone: "warn", text: `${place.name} is already booked then for "${clashes[0].title}". Pick another space or time.` });

    const { hour, minute, weekday } = parts(end);
    const endMins = +hour * 60 + +minute;
    const weekend = ["Sat", "Sun"].includes(weekday);
    if (endMins > (weekend ? 22 * 60 : 21 * 60) || endMins < startMin % (24 * 60) - 1) {
        notes.push({ tone: "warn", text: `Temple Rule: events end by ${weekend ? "22:00 at weekends" : "21:00 on weekdays"}. Bring the finish time forward.` });
    }
    if (guests >= 100) {
        const cars = Math.round(guests / 3);
        notes.push({ tone: "idea", text: `About ${cars} cars at 3 people a car. If the car park can't take that many, ask families to share cars and put volunteers on the gate.` });
    }

    // Tasks: last time's, if there was a similar event; otherwise the usual ones for this kind.
    const last = await findLastTime(title);
    let tasks;
    let basedOn = null;
    if (last) {
        const shift = start.getTime() - new Date(last.starts_at).getTime();
        // Numbers of people move with the new event ("prasad for 200" → "for 250"): marked Updated
        const resize = (title) => (last.guests && guests && last.guests !== guests
            ? title.replace(new RegExp(`\\b${last.guests}(\\s+(?:people|guests|devotees))`), `${guests}$1`) : title);
        tasks = last.tasks.map((t) => ({
            title: resize(t.title.replaceAll(last.resource_name, place.name)),
            change: resize(t.title) !== t.title ? `Updated from ${last.guests} to ${guests} people` : (last.resource_name !== place.name && t.title.includes(last.resource_name) ? `Moved from ${last.resource_name}` : null),
            assigned_to: t.assigned_to_name ? t.assigned_to : null,
            assigned_to_name: t.assigned_to_name ?? null,
            assigned_group: t.assigned_to_name ? null : (t.assigned_group ?? "volunteer"),
            due_at: t.due_at ? new Date(new Date(t.due_at).getTime() + shift).toISOString() : at(start, -60),
            category: t.category,
            requires_verification: t.requires_verification,
            section: "last_time",
        }));
        basedOn = { id: last.id, title: last.title, starts_at: last.starts_at, tasks: last.tasks.length };
    } else {
        tasks = [
            ...prepTasksFor({ title, starts_at: start, ends_at: end, resource_name: place.name, guests }).map((t) => ({ ...t, assigned_to: null, section: "space" })),
            ...extrasFor(kind.key, { title, place: place.name, guests, start, end }),
        ];
    }
    // Size-based extras are added even when copying last time, unless already there.
    if (last) {
        for (const extra of extrasFor("none", { title, place: place.name, guests, start, end })) {
            if (!tasks.some((t) => t.title.toLowerCase() === extra.title.toLowerCase())) tasks.push({ ...extra, added: true });
        }
    }
    // Nothing due in the past: pull early prep forward to soon.
    const soon = Date.now() + 30 * 60_000;
    tasks = tasks.map((t) => (new Date(t.due_at).getTime() < soon ? { ...t, due_at: new Date(Math.min(soon, start.getTime())).toISOString() } : t))
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    const when = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short" }).format(start);
    const hhmm = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    const reply = basedOn
        ? `Here's a draft for ${title} on ${when}, ${hhmm(start)}–${hhmm(end)} in ${place.name}, based on "${basedOn.title}" last time (${basedOn.tasks} tasks). Check it and confirm when you're happy.`
        : `${title}: ${when}, ${hhmm(start)}–${hhmm(end)} in ${place.name}${guests ? ` for ${guests} people` : ""}. I've put it in a draft plan. Here are the jobs the team usually does for this. Tick what you want and add it to the plan.`;

    return {
        reply,
        draft: {
            event: { title, resource_id: place.id, resource_name: place.name, resource_capacity: place.capacity, starts_at: start.toISOString(), ends_at: end.toISOString(), guests: guests ?? null, kind: kind.key },
            tasks,
            notes,
            based_on: basedOn,
        },
    };
};
