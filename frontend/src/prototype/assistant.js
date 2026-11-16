import { RULES, ROLES } from './data'
import { isOverdue, assigneeLabel, dailySummary, fmtInline } from './lib'

// Placeholder "AI". It only answers from the temple's own rules and live task data, and says so
// when it doesn't know (the "no guessing from public sources" guardrail from the client call).
// Replace with a real LLM call (backend) that is grounded on the same sources.
export function answer(q, s) {
  const text = q.toLowerCase()
  const words = text.split(/[^a-z]+/)

  if (/(summary|summarise|summarize|today|how are we|status)/.test(text)) {
    return { text: dailySummary(s).join('\n'), sources: ['Live task data'] }
  }
  if (/(overdue|pending|not done|chase|follow up|follow-up|late)/.test(text)) {
    const od = s.tasks.filter(isOverdue)
    if (!od.length) return { text: 'Nothing is overdue right now.', sources: ['Live task data'] }
    return {
      text: `${od.length} task${od.length > 1 ? 's are' : ' is'} overdue:\n` + od.map((t) => `• ${t.title} (${assigneeLabel(t.assignee, s.users)}, due ${fmtInline(t.due)})`).join('\n') + '\n\nOpen the Dashboard to send a reminder with one click.',
      sources: ['Live task data'],
    }
  }

  // Most specific rule first: hall hire is the generic fallback when a more specific rule also matches.
  const PRIORITY = ['R1', 'R3', 'R5', 'R4', 'R2']
  const hits = RULES.filter((r) => r.keys.some((k) => words.includes(k) || words.includes(k + 's')))
    .sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id))
  if (hits.length) {
    const main = hits[0]
    let verdict = ''
    if (main.id === 'R1') verdict = 'Recommendation: not inside the main mandir. It could be allowed in the Community Hall if it is a charity or community stall and the committee approves it at least 14 days ahead.\n\n'
    if (main.id === 'R2') verdict = 'Recommendation: fine to accept if there is a named contact, a deposit, and it finishes by 10pm.\n\n'
    if (main.id === 'R3') verdict = 'Recommendation: only if the food is vegetarian and there is no alcohol.\n\n'
    return {
      text: verdict + hits.map((r) => `${r.id} · ${r.title}: ${r.text}`).join('\n'),
      sources: hits.map((r) => `Sample rule ${r.id}`),
      action: main.id === 'R1' || main.id === 'R2' ? { label: 'Create a follow-up task for me', title: `Reply to member: ${q.slice(0, 60)}` } : null,
    }
  }

  const mem = s.memory.filter((m) => words.some((w) => w.length > 3 && m.text.toLowerCase().includes(w)))
  if (mem.length) {
    return { text: 'From the temple notes:\n' + mem.map((m) => `• ${m.text}`).join('\n'), sources: ['Temple notes'] }
  }

  return {
    text: "I couldn't find this in the temple's rules or notes, so I won't guess. Add the relevant rule or a note on the right, and I'll use it next time.",
    sources: [],
  }
}

// Placeholder "AI" suggestions for a booking: extra tasks beyond the standard prep list, each with the reason.
// Grounded only on the booking itself, the sample rules and the temple calendar. A real model would also learn
// from past bookings (what got flagged last time) once there is history in the database.
export function suggestBookingTasks(b, s) {
  const text = b.title.toLowerCase()
  const start = new Date(`${b.date}T${b.start}`)
  const end = new Date(`${b.date}T${b.end}`)
  // Lead times are ideals; for a booking made at short notice, never set a due time in the past.
  const soonest = Date.now() + 60 * 60000
  const at = (d, m) => new Date(Math.max(d.getTime() + m * 60000, Math.min(soonest, d.getTime()))).toISOString()
  const role = (id) => ({ type: 'role', id })
  const out = []
  const add = (title, assignee, due, reason, extra = {}) => out.push({ title, assignee, due, reason, area: b.space, priority: 'normal', critical: false, ...extra })

  if (b.puja) {
    add(`Arrange flowers and garlands for ${b.title}`, role('carer'), at(start, -24 * 60), 'It includes a puja')
    add(`Prepare prasad for ${b.title}`, role('cook'), at(start, -90), 'It includes a puja')
  }
  if (/(birthday|party|wedding|anniversary|celebration|reception|lunch|dinner|meal|food|catering)/.test(text)) {
    add(`Confirm with ${b.contact || 'the organiser'}: vegetarian food only, no alcohol`, { type: 'user', id: 'u1' }, at(start, -2 * 24 * 60), 'Food is likely. Sample rule R3: vegetarian only, no alcohol', { category: 'Admin & committee' })
    add(`Extra bin bags and kitchen clean-up after ${b.title}`, role('cleaner'), at(end, 90), 'Food events leave more rubbish')
  }
  if (/(class|yoga|meeting|workshop|lecture|talk|training)/.test(text)) {
    add(`Check ${b.space} is set up for ${b.title} (mats / chairs / screen)`, role('carer'), at(start, -30), 'Classes and meetings need a specific room setup')
  }
  if (['Shivaji Hall', 'Community Hall'].includes(b.space)) {
    add(`Volunteer to welcome guests at ${b.title}`, role('volunteer'), at(start, -15), 'Hall events usually need someone at the door')
  }
  if (b.end >= '19:30') {
    add('Check car park and outside lights are on', role('security'), at(end, -30), 'It finishes after dark', { category: 'Security & closing' })
  }
  if (!b.phone && !b.email) {
    add(`Get a phone number for ${b.contact || 'the booking contact'} and confirm the deposit`, { type: 'user', id: 'u1' }, at(start, -3 * 24 * 60), 'No phone or email given. Sample rule R2 asks for a named contact and a deposit', { category: 'Admin & committee' })
  }
  const near = s.observances.find((o) => o.big && Math.abs(new Date(`${o.date}T00:00`) - new Date(`${b.date}T00:00`)) <= 2 * 86400000)
  if (near) {
    add(`Check ${b.space} doesn't clash with ${near.name} setup`, role('committee'), at(start, -2 * 24 * 60), `${near.name} is within 2 days`, { category: 'Admin & committee' })
  }
  return out.filter((t) => t.assignee.type === 'user' || ROLES[t.assignee.id])
}
