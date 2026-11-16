import { useEffect, useState } from 'react'
import { notificationsApi } from '../../api/endpoints'
import { greeting, longDate, partOfDay, timeAgo } from '../../lib/format'
import { Empty } from '../../components/ui'
import type { AppNotification } from '../../types'

// Staff / volunteer landing page. Phase 2 adds check-in and the task list.
export default function StaffHome() {
  const [updates, setUpdates] = useState<AppNotification[] | null>(null)

  useEffect(() => {
    notificationsApi
      .list()
      .then((r) => setUpdates(r.notifications.slice(0, 5)))
      .catch(() => setUpdates([]))
  }, [])

  return (
    <>
      <section className={`day-hero day-${partOfDay()}`}>
        <Mandala />
        <div className="day-top">
          <span className="day-date">{longDate()}</span>
        </div>
        <h1 className="day-title">{greeting()}</h1>
      </section>

      <section className="m-section">
        <h2>Latest updates</h2>
        {updates?.length === 0 && <Empty icon="bell">No updates yet.</Empty>}
        {updates && updates.length > 0 && (
          <div className="stack-tight">
            {updates.map((n) => (
              <div key={n.id} className="notice">
                <div>
                  <div className="strong">{n.title}</div>
                  {n.message && <div className="small">{n.message}</div>}
                  <div className="muted small">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function Mandala() {
  const petals = (n: number, r: number, rx: number, ry: number) =>
    Array.from({ length: n }, (_, i) => (
      <ellipse key={`${r}-${i}`} cx="0" cy={-r} rx={rx} ry={ry} transform={`rotate(${(360 / n) * i})`} />
    ))
  return (
    <svg className="mandala" viewBox="-100 -100 200 200" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle r="96" /><circle r="78" /><circle r="14" />
        {petals(16, 60, 10, 24)}
        {petals(8, 32, 9, 18)}
      </g>
    </svg>
  )
}
