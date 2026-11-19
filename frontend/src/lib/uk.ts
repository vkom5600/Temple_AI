// Temple time. The temple is in London, so every date and time in the app is shown
// and entered in UK time (GMT / BST), whatever the device's own time zone is.

export const TEMPLE_TZ = 'Europe/London'

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TEMPLE_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
})
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The UK wall-clock parts of an instant. m is 0–11 and wd is 0 (Sunday) – 6. */
export function ukParts(d: Date = new Date()) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month - 1, d: +p.day, h: +p.hour, min: +p.minute, wd: WEEKDAYS.indexOf(p.weekday) }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11-19": the UK date of an instant. */
export const ukDateKey = (d: Date = new Date()) => { const p = ukParts(d); return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}` }

/** The instant when the UK clock reads this date and time (days and months may overflow). */
export function ukDate(y: number, m: number, d: number, h = 0, min = 0): Date {
  const guess = Date.UTC(y, m, d, h, min)
  const offset = (t: number) => { const p = ukParts(new Date(t)); return Date.UTC(p.y, p.m, p.d, p.h, p.min) - t }
  return new Date(guess - offset(guess - offset(guess)))
}

/** From "2026-11-19" and "14:30" (as in date and time inputs) to an instant. */
export function ukFromInputs(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return ukDate(y, m - 1, d, h, min)
}

export const ukStartOfDay = (d: Date = new Date()) => { const p = ukParts(d); return ukDate(p.y, p.m, p.d) }
export const ukEndOfDay = (d: Date = new Date()) => { const p = ukParts(d); return new Date(ukDate(p.y, p.m, p.d + 1).getTime() - 1) }

/** Same UK clock time, n days later (stays correct across the clocks changing). */
export const ukAddDays = (d: Date, n: number) => { const p = ukParts(d); return ukDate(p.y, p.m, p.d + n, p.h, p.min) }

export const ukSameDay = (a: Date, b: Date) => ukDateKey(a) === ukDateKey(b)

/** A date-only string like "2026-11-19" as a Date at UK noon, for formatting it safely. */
export const ukNoon = (date: string) => ukFromInputs(date, '12:00')

// Formatting helpers (always UK time)
export const ukTime = (d: Date, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }) =>
  d.toLocaleTimeString('en-GB', { timeZone: TEMPLE_TZ, ...opts })
export const ukDay = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  d.toLocaleDateString('en-GB', { timeZone: TEMPLE_TZ, ...opts })
