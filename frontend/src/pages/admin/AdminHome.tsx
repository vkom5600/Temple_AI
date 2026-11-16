import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { usersApi } from '../../api/endpoints'
import { ROLE_GROUPS } from '../../constants'
import { greeting, longDate } from '../../lib/format'
import { ErrorNote, Spinner } from '../../components/ui'
import type { User } from '../../types'

// Admin landing page. Phase 2+ adds today's tasks, issues and bookings here.
export default function AdminHome() {
  const { user } = useAuth()
  const [people, setPeople] = useState<User[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    usersApi.list().then((r) => setPeople(r.users)).catch((e: Error) => setError(e.message))
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
