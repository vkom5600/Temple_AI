import { useState } from 'react'
import { useStore } from '../store.jsx'
import { nameOf, fmtTime, ago } from '../lib'
import { Icon, Empty, Badge } from '../ui.jsx'

// Second-person sign-off for critical tasks (locking, gas off, etc.). Used by volunteers and committee.
export default function VerifyList({ compact }) {
  const { s, me, act } = useStore()
  const list = s.tasks.filter((t) => t.status === 'awaiting').sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
  const [rejecting, setRejecting] = useState(null)
  const [note, setNote] = useState('')

  if (!list.length) return <Empty icon="shield">Nothing waiting for sign-off.</Empty>

  return (
    <div className="stack">
      {list.map((t) => {
        const own = t.completedBy === me.id
        return (
          <div key={t.id} className={`card verify ${compact ? 'compact' : ''}`}>
            <div className="verify-main">
              <div className="task-title">{t.title}</div>
              <div className="meta">
                {t.area} · done by <b>{nameOf(s.users, t.completedBy)}</b> at {fmtTime(t.completedAt)} ({ago(t.completedAt)})
              </div>
              {t.critical && <Badge tone="amber">Safety check</Badge>}
            </div>
            {own ? (
              <p className="muted small">You did this task, so someone else needs to check it.</p>
            ) : rejecting === t.id ? (
              <div className="reject-box">
                <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong? e.g. back door still open" />
                <div className="row">
                  <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      act({ type: 'reject', id: t.id, note, log: `Sent back "${t.title}"`, toast: `Sent back to ${nameOf(s.users, t.completedBy)}` })
                      setRejecting(null)
                      setNote('')
                    }}
                  >
                    Send back
                  </button>
                </div>
              </div>
            ) : (
              <div className="row verify-actions">
                <button className="btn btn-ghost" onClick={() => setRejecting(t.id)}><Icon name="x" size={16} /> Not done</button>
                <button className="btn btn-success" onClick={() => act({ type: 'verify', id: t.id, log: `Signed off "${t.title}"`, toast: 'Signed off. Task closed.' })}>
                  <Icon name="shield" size={16} /> I checked, sign off
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
