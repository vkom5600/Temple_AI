import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { tasksApi } from '../api/endpoints'
import { BRAND } from '../branding'
import { ROLE_LABELS } from '../constants'
import { NotificationsPanel, useUnreadCount } from '../components/NotificationBell'
import AskAiPanel from '../components/AskAiPanel'
import PlanWithAiPanel from '../components/PlanWithAiPanel'
import BroadcastDialog from '../components/BroadcastDialog'
import { Avatar, Icon, type IconName } from '../components/ui'
import { Gopuram } from '../components/Ornaments'
import PhoneNeedsYou from '../pages/admin/PhoneNeedsYou'
import { allowed, can } from '../lib/access'
import type { AccessArea } from '../types'
import type { TaskSummary } from '../types'

// Shared with admin pages through <Outlet context>: today's numbers, a refresh,
// and the panels pages can open (H3 Broadcast, AI1 Ask AI, AI2 Plan with AI).
interface AdminContext {
  summary: TaskSummary | null
  refreshSummary: () => void
  openBroadcast: () => void
  openAskAi: () => void
  openPlan: (idea?: string) => void
}
export const useAdminContext = () => useOutletContext<AdminContext>()

// Everything in the Action Center: overdue tasks, reported problems, safety
// sign-offs, booking requests and (for the chairman) sign-ups waiting for approval.
export const actionCount = (s: TaskSummary | null, isChairman: boolean) =>
  s ? s.overdue + s.open_issues + s.awaiting_signoff + s.pending_bookings + (s.open_questions ?? 0) + (isChairman ? s.pending_registrations : 0) : 0

// The admin web app sidebar, as in the designs (H1, AC1, T1, C1, P1, R1).
const NAV: { to: string; label: string; icon: IconName; action?: boolean; area?: AccessArea }[] = [
  { to: '/admin', label: 'Home', icon: 'grid' },
  { to: '/admin/action-center', label: 'Action Center', icon: 'bell', action: true },
  { to: '/admin/tasks', label: 'Tasks', icon: 'check-circle', area: 'tasks' },
  { to: '/admin/calendar', label: 'Calendar', icon: 'calendar', area: 'calendar' },
  { to: '/admin/people', label: 'People', icon: 'users', area: 'people' },
  { to: '/admin/reports', label: 'Reports', icon: 'chart', area: 'reports' },
]
// Pages that belong to an area (a committee member with that area Off sees a note instead)
const PAGE_AREA: [string, AccessArea][] = [['/admin/tasks', 'tasks'], ['/admin/calendar', 'calendar'], ['/admin/people', 'people'], ['/admin/attendance', 'people'], ['/admin/reports', 'reports'], ['/admin/rules', 'rules'], ['/admin/issues', 'tasks']]

const REFRESH_MS = 60_000
const PHONE = '(max-width: 760px)'

// Rao garu's phone: on a phone, Home and the Action Center become "Needs you" (AC1 phone).
function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isPhone = useIsPhone()
  const [summary, setSummary] = useState<TaskSummary | null>(null)
  const [menu, setMenu] = useState(false)
  const [asking, setAsking] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [planning, setPlanning] = useState<false | { idea?: string }>(false)
  const [notes, setNotes] = useState(false)
  const { unread, refresh: refreshUnread } = useUnreadCount()
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
  // ⌘K / Ctrl+K opens Ask AI, as in the design
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && allowed(user, 'ai')) { e.preventDefault(); setAsking(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!user) return null
  const isChairman = user.role === 'chairman'
  const waiting = actionCount(summary, isChairman)
  const context: AdminContext = { summary, refreshSummary, openBroadcast: () => setBroadcasting(true), openAskAi: () => setAsking(true), openPlan: (idea?: string) => setPlanning({ idea }) }
  const panels = (
    <>
      {asking && <AskAiPanel onClose={() => setAsking(false)} />}
      {broadcasting && <BroadcastDialog onClose={() => setBroadcasting(false)} />}
      {planning && <PlanWithAiPanel idea={planning.idea} onClose={() => setPlanning(false)} onConfirmed={refreshSummary} />}
      {notes && <NotificationsPanel onClose={() => { setNotes(false); refreshUnread() }} />}
    </>
  )

  if (isPhone && ['/admin', '/admin/', '/admin/action-center'].includes(location.pathname)) {
    return (
      <>
        <PhoneNeedsYou context={context} />
        {panels}
      </>
    )
  }

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
          {NAV.filter((item) => !item.area || can(user, item.area)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={({ isActive }) => `nav-item ${isActive ? 'on' : ''}`}>
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.action && waiting > 0 && <span className="count" aria-label={`${waiting} waiting`}>{waiting}</span>}
            </NavLink>
          ))}
        </nav>
        {allowed(user, 'ai') && <button className="ask-ai" onClick={() => setAsking(true)}>
          <span className="star">✦</span> <span className="grow" style={{ textAlign: 'left' }}>Ask AI</span> <kbd>⌘K</kbd>
        </button>}
        <div className="sidebar-foot" ref={menuRef}>
          {menu && (
            <div className="me-menu" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); setNotes(true) }}><Icon name="bell" /> Notifications{unread > 0 && <span className="count" style={{ marginLeft: 'auto' }}>{unread}</span>}</button>
              <Link to="/admin/attendance" role="menuitem"><Icon name="clock" /> Attendance records</Link>
              <Link to="/admin/issues" role="menuitem"><Icon name="flag" /> Issue history</Link>
              {isChairman && <Link to="/admin/settings" role="menuitem"><Icon name="settings" /> Settings</Link>}
              <button role="menuitem" onClick={logout}><Icon name="logout" /> Sign out</button>
            </div>
          )}
          <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <button className="me-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
              <span className="me-av"><Avatar name={user.full_name} size={36} />{unread > 0 && <i className="me-dot" aria-label={`${unread} unread notifications`} />}</span>
              <span className="who">{user.full_name.split(' ')[0]} · {ROLE_LABELS[user.role]}</span>
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <Gopuram className="page-watermark" />
        {(() => {
          const area = PAGE_AREA.find(([path]) => location.pathname.startsWith(path))?.[1]
          return area && !can(user, area)
            ? <div className="page"><div className="off-note"><Icon name="lock" size={22} /><div><b>This area is switched off for you</b><p>Ask the chairman if you need it.</p></div></div></div>
            : <Outlet context={context} />
        })()}
      </main>
      {panels}
    </div>
  )
}
