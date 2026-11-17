import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { tasksApi } from '../api/endpoints'
import { BRAND } from '../branding'
import { ROLE_LABELS } from '../constants'
import NotificationBell from '../components/NotificationBell'
import { Avatar, Icon, Modal, type IconName } from '../components/ui'
import { Gopuram } from '../components/Ornaments'
import type { TaskSummary } from '../types'

// Shared with admin pages through <Outlet context>: today's numbers + a refresh.
interface AdminContext {
  summary: TaskSummary | null
  refreshSummary: () => void
}
export const useAdminContext = () => useOutletContext<AdminContext>()

// Everything in the Action Center: overdue tasks, reported problems, safety
// sign-offs and (for the chairman) sign-ups waiting for approval.
export const actionCount = (s: TaskSummary | null, isChairman: boolean) =>
  s ? s.overdue + s.open_issues + s.awaiting_signoff + (isChairman ? s.pending_registrations : 0) : 0

// The admin web app sidebar, as in the designs (H1, AC1, T1, C1, P1, R1).
// Calendar (Google Calendar) and Reports fill in during Phases 3–4; Ask AI in Phase 3.
const NAV: { to: string; label: string; icon: IconName; action?: boolean }[] = [
  { to: '/admin', label: 'Home', icon: 'grid' },
  { to: '/admin/action-center', label: 'Action Center', icon: 'bell', action: true },
  { to: '/admin/tasks', label: 'Tasks', icon: 'check-circle' },
  { to: '/admin/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/admin/people', label: 'People', icon: 'users' },
  { to: '/admin/reports', label: 'Reports', icon: 'chart' },
]

const REFRESH_MS = 60_000

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [summary, setSummary] = useState<TaskSummary | null>(null)
  const [menu, setMenu] = useState(false)
  const [asking, setAsking] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const refreshSummary = useCallback(() => {
    tasksApi.summary().then((r) => setSummary(r.summary)).catch(() => {})
  }, [])

  // Refresh on every page change and every minute.
  useEffect(refreshSummary, [refreshSummary, location.pathname])
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && refreshSummary(), REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshSummary])
  useEffect(() => setMenu(false), [location.pathname])
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  if (!user) return null
  const isChairman = user.role === 'chairman'
  const waiting = actionCount(summary, isChairman)

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="accent-line" />
        <div className="brand">
          <img className="logo" src={BRAND.logo} alt="" />
          <div>
            <div className="brand-name">{BRAND.templeName}</div>
            <div className="brand-sub">{BRAND.tagline}</div>
          </div>
        </div>
        <nav aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={({ isActive }) => `nav-item ${isActive ? 'on' : ''}`}>
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.action && waiting > 0 && <span className="count" aria-label={`${waiting} waiting`}>{waiting}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="ask-ai" onClick={() => setAsking(true)}><span className="star">✦</span> Ask AI</button>
        <div className="sidebar-foot" ref={menuRef}>
          {menu && (
            <div className="me-menu" role="menu">
              <Link to="/admin/attendance" role="menuitem"><Icon name="clock" /> Attendance (Who's on)</Link>
              <Link to="/admin/issues" role="menuitem"><Icon name="flag" /> Issue history</Link>
              {isChairman && <Link to="/admin/settings" role="menuitem"><Icon name="settings" /> Settings</Link>}
              <button role="menuitem" onClick={logout}><Icon name="logout" /> Sign out</button>
            </div>
          )}
          <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <button className="me-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
              <Avatar name={user.full_name} size={36} />
              <span className="who">{user.full_name.split(' ')[0]} · {ROLE_LABELS[user.role]}</span>
              <Icon name="chevron-down" size={16} />
            </button>
            <NotificationBell align="up" />
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <Gopuram className="page-watermark" />
        <Outlet context={{ summary, refreshSummary } satisfies AdminContext} />
      </main>
      {asking && <AskAi onClose={() => setAsking(false)} />}
    </div>
  )
}

// AI1 Ask AI (design: screens/32_AI1). Answers only from the areas the person can see.
// The Claude connection is Phase 3; this panel shows what it will do.
const EXAMPLES = ['What is still not done today?', 'Who is on site right now?', 'Plan Diwali tasks from last year', 'Which safety checks are waiting?']

function AskAi({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Ask AI" size="drawer" subtitle="Ask about tasks, people and the temple day. Answers only use what you're allowed to see." onClose={onClose}>
      <div className="ai-banner"><span className="star">✦</span> Temple AI is connected in Phase 3. Until then, the Action Center and Home show the same answers.</div>
      <span className="ulabel">Try asking</span>
      <div className="chips">{EXAMPLES.map((q) => <span key={q} className="chip">{q}</span>)}</div>
      <div className="row" style={{ marginTop: 'auto', flexWrap: 'nowrap' }}>
        <input disabled placeholder="Ask Temple AI…" aria-label="Ask Temple AI" />
        <button className="btn btn-primary" disabled><Icon name="send" size={16} /></button>
      </div>
    </Modal>
  )
}
