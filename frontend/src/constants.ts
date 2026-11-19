import type { AuthUser, Designation, Priority, Role, TaskGroup, SignupAvailability, SignupHelp } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  chairman: 'Chairman',
  committee: 'Committee',
  staff: 'Staff',
  volunteer: 'Volunteer',
}

// Plural group headings, in the order shown on the People page.
export const ROLE_GROUPS: { role: Role; label: string }[] = [
  { role: 'chairman', label: 'Chairman' },
  { role: 'committee', label: 'Committee' },
  { role: 'staff', label: 'Staff' },
  { role: 'volunteer', label: 'Volunteers' },
]

export const DESIGNATION_LABELS: Record<Designation, string> = {
  priest: 'Priest',
  cook: 'Cook',
  cleaner: 'Cleaner',
  caretaker: 'Caretaker',
  security: 'Security',
  maintenance: 'Maintenance',
}

export const isAdmin = (user: Pick<AuthUser, 'role'> | null): boolean =>
  user?.role === 'chairman' || user?.role === 'committee'

// "Priest" for staff, otherwise the role ("Committee", "Volunteer").
export const jobLabel = (user: Pick<AuthUser, 'role' | 'designation'>): string =>
  user.designation ? DESIGNATION_LABELS[user.designation] : ROLE_LABELS[user.role]

export const homePath = (user: Pick<AuthUser, 'role'>): string => (isAdmin(user) ? '/admin' : '/staff')

// ---------- Phase 2: tasks + issues ----------

// "Assign to a group" options: one shared task for everyone in it.
export const TASK_GROUP_LABELS: Record<TaskGroup, string> = {
  ...DESIGNATION_LABELS,
  staff: 'All staff',
  volunteer: 'Volunteers',
  committee: 'Committee',
}

// Temple spaces (from the prototype). Free text is stored, so this list can change.
export const AREAS = ['Main Mandir', 'Shivaji Hall', 'Community Hall', 'Room G37', 'Room G38', 'Kitchen', 'Whole compound']

export const CATEGORIES = [
  'Puja & rituals', 'Cleaning', 'Kitchen', 'Security & closing', 'Maintenance',
  'Events & bookings', 'Admin & committee', 'General', 'Other',
]

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'High', normal: 'Normal', low: 'Low' }

// Problem types on "Can't do this?" / "Report a problem".
export const ISSUE_REASONS = ['Something is broken', 'Supplies missing', 'Not enough time', 'Other']

// Quick starts on the New task form.
export const TASK_TEMPLATES: {
  title: string; group: TaskGroup; area: string; category: string; safety: boolean; recurrence: 'none' | 'daily' | 'weekly'; priority: Priority
}[] = [
  { title: 'Closing: lamps off and all doors locked', group: 'priest', area: 'Main Mandir', category: 'Security & closing', safety: true, recurrence: 'daily', priority: 'high' },
  { title: 'Kitchen closing: gas off, stove off, electrics off', group: 'cook', area: 'Kitchen', category: 'Kitchen', safety: true, recurrence: 'daily', priority: 'high' },
  { title: 'Deep clean the hall', group: 'cleaner', area: 'Shivaji Hall', category: 'Cleaning', safety: false, recurrence: 'none', priority: 'normal' },
  { title: 'Check fire extinguishers', group: 'maintenance', area: 'Whole compound', category: 'Maintenance', safety: true, recurrence: 'weekly', priority: 'normal' },
]

// W2 sign-up form choices
export const AVAILABILITY_LABELS: Record<SignupAvailability, string> = {
  weekday_mornings: 'Weekday mornings', weekday_evenings: 'Weekday evenings', weekends: 'Weekends', festivals: 'Festivals',
}
export const HELP_LABELS: Record<SignupHelp, string> = {
  kitchen: 'Kitchen', cleaning: 'Cleaning', setting_up: 'Setting up', parking: 'Parking and doors', puja: 'Puja help', anything: 'Anywhere',
}
