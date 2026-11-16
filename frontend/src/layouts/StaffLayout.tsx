import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { jobLabel } from '../constants'
import NotificationBell from '../components/NotificationBell'
import { Avatar, Icon } from '../components/ui'

// Mobile-first layout for staff and volunteers.
export default function StaffLayout() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="mobile">
      <header className="m-head">
        <div className="row">
          <Avatar name={user.full_name} size={40} />
          <div>
            <div className="m-hello">Namaste, {user.full_name}</div>
            <div className="muted small">{jobLabel(user)}</div>
          </div>
        </div>
        <div className="row">
          <NotificationBell />
          <button className="icon-btn" onClick={logout} aria-label="Log out"><Icon name="logout" /></button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
