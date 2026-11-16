import { useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES } from '../data'
import { Icon, Avatar } from '../ui.jsx'
import Dashboard from './Dashboard.jsx'
import Tasks from './Tasks.jsx'
import Bookings from './Bookings.jsx'
import Issues from './Issues.jsx'
import People from './People.jsx'
import Assistant from './Assistant.jsx'
import VerifyList from '../screens/VerifyList.jsx'

export default function AdminShell() {
  const { s, me, act } = useStore()
  const [page, setPage] = useState('dashboard')
  const [taskFilter, setTaskFilter] = useState('all')

  const openIssues = s.issues.filter((i) => i.status === 'open').length
  const awaiting = s.tasks.filter((t) => t.status === 'awaiting').length

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'tasks', label: 'Tasks', icon: 'list' },
    { id: 'issues', label: 'Issues', icon: 'flag', count: openIssues },
    { id: 'signoffs', label: 'Sign-offs', icon: 'shield', count: awaiting },
    { id: 'bookings', label: 'Calendar', icon: 'calendar' },
    { id: 'people', label: 'People', icon: 'users' },
    { id: 'assistant', label: 'Assistant', icon: 'sparkle' },
  ]

  const go = (p, filter) => {
    setPage(p)
    if (filter) setTaskFilter(filter)
    window.scrollTo(0, 0)
  }

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ॐ</span>
          <div>
            <div className="brand-name">VHP Ilford Temple</div>
            <div className="brand-sub">Operations</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'on' : ''}`} onClick={() => go(n.id, n.id === 'tasks' ? 'all' : null)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.count > 0 && <span className="count">{n.count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Avatar user={me} size={32} />
          <div className="grow">
            <div className="small strong">{me.name}</div>
            <div className="muted small">{ROLES[me.role].label}</div>
          </div>
          <button className="icon-btn" onClick={() => act({ type: 'logout' })} aria-label="Log out"><Icon name="logout" /></button>
        </div>
      </aside>

      <main className="admin-main">
        {page === 'dashboard' && <Dashboard go={go} />}
        {page === 'tasks' && <Tasks filter={taskFilter} setFilter={setTaskFilter} />}
        {page === 'issues' && <Issues />}
        {page === 'signoffs' && (
          <div className="page">
            <header className="page-head"><div><h1>Sign-offs</h1><p className="muted">Safety tasks marked done that need a second person to confirm.</p></div></header>
            <VerifyList />
          </div>
        )}
        {page === 'bookings' && <Bookings />}
        {page === 'people' && <People />}
        {page === 'assistant' && <Assistant />}
      </main>
    </div>
  )
}
