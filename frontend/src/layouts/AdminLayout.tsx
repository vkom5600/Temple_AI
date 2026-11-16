import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../constants'
import NotificationBell from '../components/NotificationBell'
import { Avatar, Icon, type IconName } from '../components/ui'

// Desktop layout for chairman and committee. Add a nav item here when a
// phase brings a new admin page (Tasks, Issues, Bookings, ...).
const NAV: { to: string; label: string; icon: IconName; chairmanOnly?: boolean }[] = [
  { to: '/admin', label: 'Home', icon: 'home' },
  { to: '/admin/people', label: 'People', icon: 'users' },
  { to: '/admin/settings', label: 'Settings', icon: 'shield', chairmanOnly: true },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
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
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => `nav-item ${isActive ? 'on' : ''}`}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
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
        <Outlet />
      </main>
    </div>
  )
}
