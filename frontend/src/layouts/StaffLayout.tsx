import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BRAND } from '../branding'
import { jobLabel } from '../constants'
import NotificationBell from '../components/NotificationBell'
import { Gopuram } from '../components/Ornaments'

// Staff phone app (M1/M2): an indigo top bar with the logo, then one scrolling page.
// Sign out sits at the bottom of the page, as in the design.
export default function StaffLayout() {
  const { user } = useAuth()
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
        <NotificationBell />
      </header>
      <Outlet />
    </div>
  )
}
