import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { attendanceApi, usersApi } from '../../api/endpoints'
import { ROLE_GROUPS, TASK_GROUP_LABELS } from '../../constants'
import CheckInCard from '../../components/attendance/CheckInCard'
import { greeting, longDate } from '../../lib/format'
import { ErrorNote, Spinner } from '../../components/ui'
import { useAdminContext } from '../../layouts/AdminLayout'
import type { AttendanceDay, User } from '../../types'

// Admin landing page: today's tasks at a glance, registrations, the team.
// Phase 3+ adds bookings and the AI daily brief here.
export default function AdminHome() {
  const { user } = useAuth()
  const { summary } = useAdminContext()
  const [people, setPeople] = useState<User[] | null>(null)
  const [error, setError] = useState('')
  const [onSite, setOnSite] = useState<AttendanceDay | null>(null)

  useEffect(() => {
    usersApi.list().then((r) => setPeople(r.users)).catch((e: Error) => setError(e.message))
    attendanceApi.day().then(setOnSite).catch(() => {})
  }, [])

  const active = people?.filter((p) => p.is_active && p.approval_status === 'approved') ?? []
  const pending = people?.filter((p) => p.approval_status === 'pending') ?? []

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="muted">{longDate()}</p>
          <h1>{greeting()}, {user?.full_name}</h1>
        </div>
      </header>

      {user?.role === 'chairman' && pending.length > 0 && (
        <Link to="/admin/people" className="panel panel-attn attn-link">
          <span className="grow">
            <span className="strong">{pending.length} registration{pending.length > 1 ? 's' : ''} waiting for you</span>
            <span className="muted small block">{pending.map((p) => p.full_name).join(', ')}</span>
          </span>
          <span className="btn btn-primary btn-sm">Review</span>
        </Link>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Today</h2>
          <Link to="/admin/tasks" className="btn btn-ghost btn-sm">All tasks</Link>
        </div>
        {!summary && <Spinner />}
        {summary && (
          <div className="stats">
            <Link to="/admin/tasks" className="stat stat-link">
              <div className="stat-value">{summary.today_done}<span className="muted small"> / {summary.today_total}</span></div>
              <div className="stat-label">Tasks done today</div>
            </Link>
            <Link to="/admin/tasks?view=overdue" className={`stat stat-link ${summary.overdue ? 'stat-red' : ''}`}>
              <div className="stat-value">{summary.overdue}</div>
              <div className="stat-label">Overdue</div>
            </Link>
            <Link to="/admin/signoffs" className={`stat stat-link ${summary.awaiting_signoff ? 'stat-amber' : ''}`}>
              <div className="stat-value">{summary.awaiting_signoff}</div>
              <div className="stat-label">Waiting for sign-off</div>
            </Link>
            <Link to="/admin/issues" className={`stat stat-link ${summary.open_issues ? 'stat-red' : ''}`}>
              <div className="stat-value">{summary.open_issues}</div>
              <div className="stat-label">Open issues</div>
            </Link>
          </div>
        )}
      </section>

      {onSite && (
        <section className="panel">
          <div className="panel-head">
            <h2>Who's here</h2>
            <Link to="/admin/attendance" className="btn btn-ghost btn-sm">Who's on</Link>
          </div>
          <p className="small">
            {onSite.counts.here
              ? onSite.people.filter((p) => p.state === 'here').map((p) => p.full_name).join(', ')
              : 'Nobody is checked in right now.'}
          </p>
          {onSite.gaps.length > 0 && (
            <p className="small red">No {onSite.gaps.map((g) => TASK_GROUP_LABELS[g].toLowerCase()).join(', ')} in today.</p>
          )}
        </section>
      )}

      <CheckInCard optIn />

      <section className="panel">
        <div className="panel-head">
          <h2>The team</h2>
          <Link to="/admin/people" className="btn btn-ghost btn-sm">See everyone</Link>
        </div>
        <ErrorNote>{error}</ErrorNote>
        {!people && !error && <Spinner />}
        {people && (
          <div className="stats">
            {ROLE_GROUPS.filter((g) => g.role !== 'chairman').map((g) => (
              <div key={g.role} className="stat">
                <div className="stat-value">{active.filter((p) => p.role === g.role).length}</div>
                <div className="stat-label">{g.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
