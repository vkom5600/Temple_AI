import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BRAND } from '../branding'
import { jobLabel } from '../constants'
import { NotificationsPanel, useUnreadCount } from '../components/NotificationBell'
import { Gopuram } from '../components/Ornaments'
import { Icon } from '../components/ui'

// Staff phone app (M1/M2): an indigo top bar with the logo, then one scrolling page.
// Sign out sits at the bottom of the page, as in the design. The bell is a round
// button with a saffron count; it opens the full notifications panel.
export default function StaffLayout() {
  const { user } = useAuth()
  const { unread, refresh } = useUnreadCount()
  const [open, setOpen] = useState(false)
  if (!user) return null

  return (
    <div className="mobile">
      <Gopuram className="page-watermark" />
      <div className="accent-line" />
      <header className="m-top">
        <img className="logo" src={BRAND.logo} alt={BRAND.templeName} />
        <div className="who">
          <b>Namaste, {user.full_name.split(' ')[0]}</b>
          <span>{jobLabel(user)}</span>
        </div>
        <button className="m-bell" onClick={() => setOpen(true)} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Icon name="bell" size={20} />
          {unread > 0 && <span className="m-bell-count">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </header>
      <Outlet />
      {open && <NotificationsPanel onClose={() => { setOpen(false); refresh() }} />}
    </div>
  )
}
