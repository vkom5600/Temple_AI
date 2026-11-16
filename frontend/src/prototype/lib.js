import { ROLES } from './data'

const sameDay = (a, b) => a.toDateString() === b.toDateString()

export const isToday = (iso) => sameDay(new Date(iso), new Date())

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function fmtDay(iso) {
  const d = new Date(iso)
  const today = new Date()
  const tmr = new Date(); tmr.setDate(today.getDate() + 1)
  const yst = new Date(); yst.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, tmr)) return 'Tomorrow'
  if (sameDay(d, yst)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

export const fmtWhen = (iso) => `${fmtDay(iso)}, ${fmtTime(iso)}`

// For use inside a sentence: "today at 2:00 pm", "yesterday at …", "on Sat 31 Oct at …"
export function fmtInline(iso) {
  const d = fmtDay(iso)
  if (d === 'Today' || d === 'Tomorrow' || d === 'Yesterday') return `${d.toLowerCase()} at ${fmtTime(iso)}`
  return `on ${d} at ${fmtTime(iso)}`
}

export function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}

export const isOverdue = (t) => t.status === 'todo' && new Date(t.due) < new Date()
export const isFinished = (t) => ['done', 'verified', 'awaiting'].includes(t.status)

export const userById = (users, id) => users.find((u) => u.id === id)
export const nameOf = (users, id) => userById(users, id)?.name ?? 'Someone'

export function assigneeLabel(a, users) {
  if (a.type === 'role') return `${ROLES[a.id]?.label ?? a.id} (role)`
  return nameOf(users, a.id)
}

// People who would actually receive a task assigned to a role/person.
export function peopleFor(a, users) {
  if (a.type === 'user') return users.filter((u) => u.id === a.id)
  return users.filter((u) => u.role === a.id)
}

export const tasksForUser = (tasks, u) =>
  tasks.filter(
    (t) =>
      (t.assignee.type === 'user' && t.assignee.id === u.id) ||
      (t.assignee.type === 'role' && t.assignee.id === u.role)
  )

export const isAdmin = (u) => u && (u.role === 'chairman' || u.role === 'committee')

// Very small keyword router; the real version would use the AI with the temple's own data.
export function suggestRole(text) {
  const t = text.toLowerCase()
  if (/(gas|stove|cook|kitchen|prasad)/.test(t)) return /(broken|leak|fix|repair)/.test(t) ? 'maintenance' : 'cook'
  if (/(broken|lock|door|leak|tap|light|electric|bulb|repair|fix)/.test(t)) return 'maintenance'
  if (/(dirty|clean|bin|spill|mess)/.test(t)) return 'cleaner'
  if (/(ghee|camphor|flower|supply|supplies|stock|low on|run out|running low)/.test(t)) return 'carer'
  if (/(cctv|alarm|security|gate|stranger)/.test(t)) return 'security'
  return 'maintenance'
}

export function suggestedTitle(text) {
  const t = text.toLowerCase()
  if (/lock/.test(t) && /broken/.test(t)) return 'Repair the broken lock'
  if (/(ghee|camphor|flower|supplies|stock|running low|low on)/.test(t)) return 'Buy and restock supplies'
  const clean = text.replace(/\s+/g, ' ').trim()
  return 'Follow up: ' + (clean.length > 50 ? clean.slice(0, 50) + '…' : clean)
}

export function bookingTasks(b) {
  const start = new Date(`${b.date}T${b.start}`)
  const end = new Date(`${b.date}T${b.end}`)
  const at = (d, m) => new Date(d.getTime() + m * 60000).toISOString()
  const r = (id) => ({ type: 'role', id })
  const list = [
    { title: `Clean and prepare ${b.space}`, assignee: r('cleaner'), due: at(start, -120) },
    { title: `Set up chairs and tables in ${b.space}`, assignee: r('carer'), due: at(start, -60) },
    { title: `Unlock ${b.space} and switch on lights`, assignee: r('security'), due: at(start, -30) },
    ...(b.puja ? [{ title: `Prepare puja items for ${b.title}`, assignee: r('priest'), due: at(start, -60) }] : []),
    { title: `Clean ${b.space} after the event`, assignee: r('cleaner'), due: at(end, 60) },
    { title: `Lock ${b.space}: lights off, doors locked`, assignee: r('security'), due: at(end, 30), critical: true, priority: 'high' },
  ]
  return list.map((t) => ({
    priority: 'normal',
    critical: false,
    notes: `For booking: ${b.title} (${b.contact || 'no contact'})`,
    ...t,
    area: b.space,
    kind: 'booking',
    source: { bookingId: b.id },
  }))
}

export function reminderText(t, users, me) {
  const who = peopleFor(t.assignee, users).map((u) => u.name)
  const greet = who.length ? who.join(' / ') + ' ji' : 'ji'
  return `Namaste ${greet},\n\nA gentle reminder: "${t.title}" (${t.area}) was due ${fmtInline(t.due)}.\nCould you please complete it today, or tell us in the app if something is stopping you?\n\nThank you,\n${me.name}`
}

export function dailySummary(s) {
  const today = s.tasks.filter((t) => isToday(t.due) || isOverdue(t))
  const done = today.filter(isFinished)
  const overdue = s.tasks.filter(isOverdue)
  const awaiting = s.tasks.filter((t) => t.status === 'awaiting')
  const issues = s.issues.filter((i) => i.status === 'open')
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1)
  const tomorrow = s.bookings.filter((b) => b.date === tmr.toLocaleDateString('en-CA'))
  const lines = []
  lines.push(`${done.length} of ${today.length} tasks done today.`)
  if (overdue.length) lines.push(`Overdue: ${overdue.map((t) => t.title).join('; ')}.`)
  if (awaiting.length) lines.push(`${awaiting.length} safety task${awaiting.length > 1 ? 's' : ''} waiting for a second person to sign off.`)
  if (issues.length) lines.push(`Open issues: ${issues.map((i) => i.text.replace(/\.$/, '')).join('; ')}.`)
  if (tomorrow.length) lines.push(`Tomorrow: ${tomorrow.map((b) => `${b.title} in ${b.space} at ${b.start}`).join('; ')}.`)
  if (!overdue.length && !issues.length) lines.push('Nothing urgent. Everything is on track.')
  return lines
}

export function ymd(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA')
}

const relDay = (date) => {
  const days = Math.round((new Date(`${date}T00:00`) - new Date(`${ymd(0)}T00:00`)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return new Date(`${date}T00:00`).toLocaleDateString([], { weekday: 'long' })
  return new Date(`${date}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

// Today's bookings, sorted, with whether they're finished, on now or still to come.
export function eventsToday(s) {
  const now = new Date().toTimeString().slice(0, 5)
  return s.bookings
    .filter((b) => b.date === ymd(0))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((b) => ({ ...b, state: b.end <= now ? 'finished' : b.start <= now ? 'on' : 'later' }))
}

// Two bookings in the same space with overlapping times.
export function clashes(events) {
  return events.some((a, i) => events.some((b, j) => j > i && a.space === b.space && a.start < b.end && b.start < a.end))
}

// Next few things after today: bookings and festivals together.
export function comingUp(s, n = 3) {
  const t = ymd(0)
  const items = [
    ...s.bookings.filter((b) => b.date > t).map((b) => ({ id: b.id, date: b.date, when: `${relDay(b.date)} ${b.start}`, title: b.title })),
    ...s.observances.filter((o) => o.date > t).map((o) => ({ id: o.id, date: o.date, when: relDay(o.date), title: o.name, festival: true })),
  ]
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, n)
}

export const observanceToday = (s) => s.observances.find((o) => o.date === ymd(0))

// Category of a task: set explicitly, or inferred for older tasks from the booking link / role.
const ROLE_CATEGORY = { priest: 'Puja & rituals', cook: 'Kitchen', cleaner: 'Cleaning', security: 'Security & closing', maintenance: 'Maintenance', chairman: 'Admin & committee', committee: 'Admin & committee' }
export function categoryOf(t, users = []) {
  if (t.category) return t.category
  if (t.kind === 'booking' || t.source?.bookingId) return 'Events & bookings'
  const role = t.assignee.type === 'role' ? t.assignee.id : users.find((u) => u.id === t.assignee.id)?.role
  return ROLE_CATEGORY[role] ?? 'General'
}

// Links that open WhatsApp / the phone's text app / email with the message already written.
// Stand-in for automatic sending (WhatsApp Business API or Twilio SMS) once the backend exists.
const digits = (phone) => (phone || '').replace(/[^\d]/g, '')
export function sendLinks(user, text, subject = 'VHP Ilford Temple') {
  const body = encodeURIComponent(text)
  return {
    whatsapp: user.phone ? `https://wa.me/${digits(user.phone)}?text=${body}` : null,
    sms: user.phone ? `sms:${user.phone.replace(/\s/g, '')}?&body=${body}` : null,
    email: user.email ? `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${body}` : null,
  }
}

export const daysSince = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000)
