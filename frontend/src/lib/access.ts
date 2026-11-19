import { useAuth } from '../auth/AuthContext'
import type { Access, AccessArea, AuthUser } from '../types'

// Committee access per area (P2). The server checks every request; these helpers
// only decide what to show. The chairman's access comes back as "everything".

export const AREA_INFO: { area: AccessArea; label: string; hint: string; icon: 'check-circle' | 'calendar' | 'users' | 'shield' | 'chart'; levels: Access[AccessArea][] }[] = [
  { area: 'tasks', label: 'Tasks', hint: 'Create, assign and sign off tasks', icon: 'check-circle', levels: ['off', 'view', 'manage'] },
  { area: 'calendar', label: 'Calendar and bookings', hint: 'Approve requests, add events and festivals', icon: 'calendar', levels: ['off', 'view', 'manage'] },
  { area: 'people', label: 'People and volunteers', hint: 'Add staff and volunteers, open registration, approve sign-ups', icon: 'users', levels: ['off', 'view', 'manage'] },
  { area: 'rules', label: 'Temple Rules', hint: 'Change the rules Temple AI checks', icon: 'shield', levels: ['off', 'view', 'manage'] },
  { area: 'reports', label: 'Reports', hint: 'Daily, weekly and monthly reports, activity log', icon: 'chart', levels: ['off', 'view'] },
]

export const DEFAULT_ACCESS: Access = { tasks: 'manage', calendar: 'manage', people: 'view', rules: 'manage', reports: 'view', broadcast: true, ai: true }

export const can = (user: AuthUser | null, area: AccessArea, level: 'view' | 'manage' = 'view') => {
  if (!user) return false
  if (user.role === 'chairman') return true
  const have = (user.access ?? DEFAULT_ACCESS)[area]
  return level === 'view' ? have !== 'off' : have === 'manage'
}
export const allowed = (user: AuthUser | null, flag: 'broadcast' | 'ai') =>
  !!user && (user.role === 'chairman' || (user.access ?? DEFAULT_ACCESS)[flag])

export function useAccess() {
  const { user } = useAuth()
  return {
    can: (area: AccessArea, level: 'view' | 'manage' = 'view') => can(user, area, level),
    allowed: (flag: 'broadcast' | 'ai') => allowed(user, flag),
  }
}
