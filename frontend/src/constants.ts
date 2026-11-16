import type { AuthUser, Designation, Role } from './types'

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
