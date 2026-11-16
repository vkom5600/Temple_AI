// Mock data for the prototype. Everything here is a placeholder until the backend (Node + PostgreSQL) exists.
// Due times are relative to "now" so the demo always has a mix of done, upcoming and overdue tasks.

const MIN = 60 * 1000
const base = Date.now()
const rel = (mins) => new Date(base + mins * MIN).toISOString()

// Top-level groups agreed on the call: staff, committee, volunteers (+ chairman as super admin).
export const GROUPS = {
  admin: 'Chairman',
  committee: 'Committee',
  staff: 'Staff',
  volunteer: 'Volunteers',
}

// Sub-roles. Tasks can be assigned to a role (anyone in it sees the task) or to one person.
export const ROLES = {
  chairman: { label: 'Chairman', group: 'admin' },
  committee: { label: 'Committee member', group: 'committee' },
  priest: { label: 'Priest', group: 'staff' },
  cook: { label: 'Cook', group: 'staff' },
  cleaner: { label: 'Cleaner', group: 'staff' },
  carer: { label: 'Caretaker', group: 'staff' },
  security: { label: 'Security', group: 'staff' },
  maintenance: { label: 'Maintenance', group: 'staff' },
  volunteer: { label: 'Volunteer', group: 'volunteer' },
}

export const AREAS = [
  'Main Mandir',
  'Shivaji Hall',
  'Community Hall',
  'Room G37',
  'Room G38',
  'Kitchen',
  'Whole compound',
]

// Broad task categories. "Other" lets the admin type their own.
export const CATEGORIES = [
  'Puja & rituals',
  'Cleaning',
  'Kitchen',
  'Security & closing',
  'Maintenance',
  'Events & bookings',
  'Admin & committee',
  'General',
  'Other',
]

export const BOOKABLE = ['Shivaji Hall', 'Community Hall', 'Room G37', 'Room G38']

export const USERS = [
  { id: 'u1', name: 'Raghu', role: 'chairman', phone: '+44 7700 900001', email: 'raghu@example.org' },
  { id: 'u2', name: 'Meena', role: 'committee', phone: '+44 7700 900021', email: 'meena@example.org' },
  { id: 'u3', name: 'Suresh', role: 'committee', phone: '+44 7700 900002' },
  { id: 'u4', name: 'Anil', role: 'priest', phone: '+44 7700 900004' },
  { id: 'u5', name: 'Sidhu', role: 'priest', phone: '+44 7700 900005' },
  { id: 'u6', name: 'Kamla', role: 'cook', phone: '+44 7700 900006' },
  { id: 'u7', name: 'Ramesh', role: 'cleaner', phone: '+44 7700 900007' },
  { id: 'u8', name: 'Jaya', role: 'carer', phone: '+44 7700 900008' },
  { id: 'u9', name: 'Dev', role: 'security', phone: '+44 7700 900009' },
  { id: 'u10', name: 'Harish', role: 'maintenance', phone: '+44 7700 900010' },
  { id: 'u11', name: 'Priya', role: 'volunteer', phone: '+44 7700 900011' },
  { id: 'u12', name: 'Vikram', role: 'volunteer', phone: '+44 7700 900012' },
]

const role = (id) => ({ type: 'role', id })
const user = (id) => ({ type: 'user', id })

const T = (o) => ({
  priority: 'normal',
  critical: false,
  kind: 'daily',
  status: 'todo',
  notes: '',
  comments: [],
  ...o,
})

export const TASKS = [
  // Priest
  T({ id: 't1', title: 'Open the temple and light the lamps', assignee: role('priest'), area: 'Main Mandir', due: rel(-240), status: 'done', completedBy: 'u4', completedAt: rel(-245) }),
  T({ id: 't2', title: 'Morning puja and aarti', assignee: role('priest'), area: 'Main Mandir', due: rel(-180), status: 'done', completedBy: 'u4', completedAt: rel(-170) }),
  T({ id: 't3', title: 'Prepare items for evening aarti', assignee: role('priest'), area: 'Main Mandir', due: rel(90) }),
  T({ id: 't4', title: 'Closing: lamps off and all doors locked', assignee: role('priest'), area: 'Main Mandir', due: rel(360), critical: true, priority: 'high' }),
  // Cook
  T({ id: 't5', title: 'Prepare prasad for evening', assignee: role('cook'), area: 'Kitchen', due: rel(-45) }),
  T({ id: 't6', title: 'Kitchen closing: gas off, stove off, electrics off', assignee: role('cook'), area: 'Kitchen', due: rel(300), critical: true, priority: 'high' }),
  // Cleaner
  T({ id: 't7', title: 'Clean the main mandir floor', assignee: role('cleaner'), area: 'Main Mandir', due: rel(-120), status: 'done', completedBy: 'u7', completedAt: rel(-110) }),
  T({ id: 't8', title: 'Clean Shivaji Hall after morning class', assignee: role('cleaner'), area: 'Shivaji Hall', due: rel(-30) }),
  T({ id: 't9', title: 'Empty all bins', assignee: role('cleaner'), area: 'Whole compound', due: rel(120) }),
  // Security
  T({ id: 't10', title: 'Check all doors and gates', assignee: role('security'), area: 'Whole compound', due: rel(-60), status: 'flagged', comments: [{ by: 'u9', text: 'Side door lock is broken, could not lock it.', at: rel(-55) }] }),
  T({ id: 't11', title: 'Lock Community Hall after yoga class', assignee: user('u9'), area: 'Community Hall', due: rel(-25), critical: true, kind: 'booking', source: { bookingId: 'b1' }, status: 'awaiting', completedBy: 'u9', completedAt: rel(-20) }),
  T({ id: 't12', title: 'Evening security round', assignee: role('security'), area: 'Whole compound', due: rel(240), critical: true }),
  // Maintenance: the "it's been 2 days" example from the call
  T({ id: 't13', title: 'Fix the leaking tap in the kitchen', assignee: user('u10'), area: 'Kitchen', due: rel(-2 * 24 * 60), kind: 'one-off', priority: 'high' }),
  // Caretaker
  T({ id: 't14', title: 'Restock puja supplies (ghee, camphor, flowers)', assignee: role('carer'), area: 'Main Mandir', due: rel(60) }),
  // Volunteers
  T({ id: 't15', title: 'Welcome visitors at evening aarti', assignee: role('volunteer'), area: 'Main Mandir', due: rel(150) }),
  // Chairman's own follow-ups
  T({ id: 't16', title: 'Reply to member about stall request', assignee: user('u1'), area: 'Community Hall', due: rel(-26 * 60), kind: 'one-off' }),
]

export const ISSUES = [
  { id: 'i1', taskId: 't10', text: 'Side door lock is broken, could not lock it.', reason: 'Something is broken', by: 'u9', at: rel(-55), status: 'open' },
  { id: 'i2', taskId: null, text: 'Running low on ghee for the lamps. Maybe 2 days left.', reason: 'Supplies missing', by: 'u4', at: rel(-150), status: 'open' },
]

const ymd = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA')
}

export const BOOKINGS = [
  { id: 'b1', space: 'Community Hall', title: 'Yoga class', contact: 'Neha (instructor)', date: ymd(0), start: '09:00', end: '10:30', puja: false },
  { id: 'b2', space: 'Shivaji Hall', title: 'Satyanarayan Puja (Patel family)', contact: 'Mr Patel', date: ymd(1), start: '11:00', end: '14:00', puja: true },
  { id: 'b4', space: 'Room G37', title: 'Bhajan evening', contact: 'Suresh', date: ymd(0), start: '18:00', end: '19:30', puja: false },
  { id: 'b3', space: 'Community Hall', title: 'Diwali volunteers meeting', contact: 'Meena', date: ymd(3), start: '18:30', end: '20:00', puja: false },
]

// Today's rota: who covers each role. An empty list is a gap (no volunteer today means no one to sign off safety tasks).
export const ROTA = {
  priest: ['u4'],
  cook: ['u6'],
  cleaner: ['u7'],
  carer: ['u8'],
  security: ['u9'],
  volunteer: [],
}

// Who has tapped "I'm here" today (user id -> time).
export const CHECKINS = {
  u4: rel(-255),
  u6: rel(-200),
  u7: rel(-150),
  u9: rel(-90),
}

// Sample phone numbers use Ofcom's reserved 07700 900xxx range, so they can't reach a real person.

// SAMPLE festivals and observances (big = needs setup, so bookings nearby may clash) with made-up dates. The real list should come from the temple's own
// calendar (Google Calendar) rather than being calculated in code: tithis depend on location and timezone.
export const OBSERVANCES = [
  { id: 'o1', date: ymd(0), name: 'Ekadashi', sample: true },
  { id: 'o2', date: ymd(5), name: 'Diwali', sample: true, big: true },
  { id: 'o3', date: ymd(7), name: 'Govardhan Puja', sample: true, big: true },
]

export const MESSAGES = [
  { id: 'm1', by: 'u1', text: 'Diwali preparations start this week. Please check your tasks every morning and tell us early if something is a problem.', at: rel(-300) },
]

export const MEMORY = [
  { id: 'n1', text: 'A member asked to set up a stall in the mandir. Waiting for the committee to decide.', by: 'u1', at: rel(-26 * 60), kind: 'request', status: 'open' },
]

// SAMPLE rules: placeholders until the temple's real policies are uploaded (planned via SharePoint).
export const RULES = [
  { id: 'R1', title: 'Stalls and selling', text: 'No commercial stalls inside the main mandir. Charity or community stalls are allowed only in the Community Hall, with committee approval at least 14 days before.', keys: ['stall', 'sell', 'selling', 'shop', 'market'] },
  { id: 'R2', title: 'Hall hire', text: 'Shivaji Hall and Community Hall bookings need a named contact and a deposit, and must finish by 10pm.', keys: ['hire', 'book', 'booking', 'hall', 'party', 'rent'] },
  { id: 'R3', title: 'Food on premises', text: 'Only vegetarian food is allowed. No alcohol anywhere on the premises.', keys: ['food', 'eat', 'catering', 'alcohol', 'meat', 'drink'] },
  { id: 'R4', title: 'Closing the temple', text: 'The last person leaving must confirm lamps off, gas off and doors locked. A second person signs off.', keys: ['close', 'closing', 'lock', 'gas', 'lamp'] },
  { id: 'R5', title: 'Photography', text: 'Photography in the main mandir only with the priest’s permission. No flash during aarti.', keys: ['photo', 'camera', 'video', 'film', 'photography'] },
]

// Quick templates the admin can start from when creating a task.
export const TEMPLATES = [
  { title: 'Closing: lamps off and all doors locked', assignee: role('priest'), area: 'Main Mandir', critical: true, kind: 'daily', priority: 'high' },
  { title: 'Kitchen closing: gas off, stove off, electrics off', assignee: role('cook'), area: 'Kitchen', critical: true, kind: 'daily', priority: 'high' },
  { title: 'Deep clean the hall', assignee: role('cleaner'), area: 'Shivaji Hall', critical: false, kind: 'one-off', priority: 'normal' },
  { title: 'Check fire extinguishers', assignee: role('maintenance'), area: 'Whole compound', critical: true, kind: 'weekly', priority: 'normal' },
]

// SAMPLE history for the 7-day chart (share of tasks finished each day). Replaced by real records later.
export const HISTORY = [92, 85, 100, 78, 88, 95].map((pct, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (6 - i))
  return { date: d.toLocaleDateString('en-CA'), pct }
})
