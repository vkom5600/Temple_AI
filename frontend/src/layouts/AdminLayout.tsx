import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { tasksApi } from '../api/endpoints'
import { ROLE_LABELS } from '../constants'
import NotificationBell from '../components/NotificationBell'
import { Avatar, Icon, type IconName } from '../components/ui'
import type { TaskSummary } from '../types'

// Shared with admin pages through <Outlet context>: today's numbers + a refresh.
interface AdminContext {
  summary: TaskSummary | null
  refreshSummary: () => void
}
export const useAdminContext = () => useOutletContext<AdminContext>()

type Count = keyof TaskSummary

// Desktop layout for chairman and committee. Add a nav item here when a
// phase brings a new admin page.
const NAV: { to: string; label: string; icon: IconName; count?: Count; chairmanOnly?: boolean }[] = [
  { to: '/admin', label: 'Home', icon: 'home' },
  { to: '/admin/tasks', label: 'Tasks', icon: 'list', count: 'overdue' },
  { to: '/admin/issues', label: 'Issues', icon: 'flag', count: 'open_issues' },
  { to: '/admin/signoffs', label: 'Sign-offs', icon: 'shield', count: 'awaiting_signoff' },
  { to: '/admin/attendance', label: "Who's on", icon: 'clock' },
  { to: '/admin/people', label: 'People', icon: 'users' },
  { to: '/admin/settings', label: 'Settings', icon: 'shield', chairmanOnly: true },
]

const REFRESH_MS = 60_000

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [summary, setSummary] = useState<TaskSummary | null>(null)

  const refreshSummary = useCallback(() => {
    tasksApi.summary().then((r) => setSummary(r.summary)).catch(() => {})
  }, [])

  // Refresh on every page change and every minute.
  useEffect(refreshSummary, [refreshSummary, location.pathname])
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && refreshSummary(), REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshSummary])

  if (!user) return null
  const nav = NAV.filter((item) => !item.chairmanOnly || user.role === 'chairman')

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ॐ</span>
          <div>
            <div className="brand-name">Temple AI</div>
            <div className="brand-sub">Operations</div>
          </div>
        </div>
        <nav aria-label="Main">
          {nav.map((item) => {
            const count = item.count && summary ? summary[item.count] : 0
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={({ isActive }) => `nav-item ${isActive ? 'on' : ''}`}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {count > 0 && <span className="count" aria-label={`${count} ${item.count === 'overdue' ? 'overdue' : 'waiting'}`}>{count}</span>}
              </NavLink>
            )
          })}
        </nav>
        <div className="sidebar-foot">
          <Avatar name={user.full_name} size={32} />
          <div className="grow">
            <div className="small strong">{user.full_name}</div>
            <div className="muted small">{ROLE_LABELS[user.role]}</div>
          </div>
          <NotificationBell align="up" />
          <button className="icon-btn" onClick={logout} aria-label="Log out"><Icon name="logout" /></button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet context={{ summary, refreshSummary } satisfies AdminContext} />
      </main>
    </div>
  )
}
