import { useEffect, useState } from 'react'
import { settingsApi, usersApi } from '../../api/endpoints'
import { DESIGNATION_LABELS, ROLE_LABELS } from '../../constants'
import { timeAgo } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Modal } from '../../components/ui'
import type { User } from '../../types'

// P1 with registration + P5 Check new sign-ups (designs: screens/27_P1, 29_P5).
// The card on People shows whether sign-ups are open and how many are waiting;
// "Review" opens the side panel with one card per person: Approve or Not now.

export function SignupsCard({ pending, onReview }: { pending: User[]; onReview: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    settingsApi.list().then((r) => setOpen(Boolean(r.settings.find((s) => s.key === 'registration_open')?.value))).catch(() => {})
  }, [])

  const toggle = async () => {
    try {
      const r = await settingsApi.update('registration_open', !open)
      setOpen(Boolean(r.settings.find((s) => s.key === 'registration_open')?.value))
      toast(open ? 'Sign-ups closed' : 'Sign-ups open: anyone with the link can register')
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <section className="list-card reg-card">
      <div className="grow">
        <h3>
          Sign-ups
          {open !== null && (
            <button className={`switch ${open ? 'on' : ''}`} role="switch" aria-checked={open} aria-label="Sign-ups open" onClick={toggle}><span className="switch-knob" /></button>
          )}
          {open !== null && <span className={open ? 'state-open' : 'state-closed'}>{open ? 'Open' : 'Closed'}</span>}
        </h3>
        <div className="muted">New volunteers, staff and committee register at <b>/register</b>. Nobody can sign in until you approve them.</div>
      </div>
      {pending.length > 0 ? (
        <>
          <span className="waiting-line"><span className="dot" /> {pending.length} {pending.length === 1 ? 'person' : 'people'} waiting</span>
          <button className="btn btn-primary" onClick={onReview}>Review</button>
        </>
      ) : (
        <span className="muted">Nobody waiting</span>
      )}
    </section>
  )
}

export function SignupsDrawer({ pending, rejected, onClose, onChange }: { pending: User[]; rejected: User[]; onClose: () => void; onChange: () => void }) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState<User | null>(null)
  const [showRejected, setShowRejected] = useState(false)

  const approve = async (u: User) => {
    setError('')
    setBusyId(u.id)
    try {
      const r = await usersApi.approve(u.id)
      toast(r.message)
      onChange()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const when = (iso: string) => {
    const d = new Date(iso)
    const today = new Date().toDateString() === d.toDateString()
    const y = new Date(); y.setDate(y.getDate() - 1)
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    if (today) return `Today, ${time}`
    if (y.toDateString() === d.toDateString()) return `Yesterday, ${time}`
    return timeAgo(iso)
  }

  return (
    <>
      <Modal
        title="New sign-ups"
        size="drawer"
        onClose={onClose}
        head={
          <div>
            <h2 className="row" style={{ gap: 12 }}><span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--saf)', display: 'inline-block' }} /> New sign-ups ({pending.length})</h2>
            <p className="modal-sub">Review people who registered to join the temple team</p>
          </div>
        }
        footer={<div className="drawer-note"><span className="tile-ic ic-ind" style={{ width: 38, height: 38 }}><Icon name="message" size={18} /></span> Approved people get an email and can sign in straight away</div>}
      >
        <ErrorNote>{error}</ErrorNote>
        {!pending.length && <p className="muted">Nobody is waiting. New sign-ups appear here.</p>}
        {pending.map((u) => (
          <article key={u.id} className="signup-card">
            <h3>{u.full_name} <span className="when-chip"><Icon name="clock" size={14} /> {when(u.created_at)}</span></h3>
            {u.phone && <div className="kv-line"><Icon name="phone" size={16} /> {u.phone}</div>}
            <div className="kv-line"><Icon name="mail" size={16} /> {u.email}</div>
            <div className="kv-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span className="ulabel">Joining as:</span>
              <span className="saf-chip"><Icon name={u.role === 'volunteer' ? 'heart' : u.role === 'staff' ? 'badge' : 'users'} size={14} /> {ROLE_LABELS[u.role]}</span>
              {u.designation && <span className="saf-chip">{DESIGNATION_LABELS[u.designation]}</span>}
            </div>
            {u.role === 'committee' && (
              <div className="quote"><b><Icon name="alert" size={16} /> Committee access</b><p>Only approve if you asked them to join. Committee members can see and manage everything.</p></div>
            )}
            <div className="signup-actions">
              <button className="btn btn-saf" disabled={busyId === u.id} onClick={() => approve(u)}><Icon name="check-circle" /> {busyId === u.id ? 'Approving…' : 'Approve'}</button>
              <button className="btn btn-outline" onClick={() => setRejecting(u)}>Not now</button>
            </div>
          </article>
        ))}
        {rejected.length > 0 && (
          <div>
            <button className="done-toggle" onClick={() => setShowRejected((v) => !v)} aria-expanded={showRejected}>
              Turned down ({rejected.length}) <Icon name="chevron-down" size={16} />
            </button>
            {showRejected && rejected.map((u) => (
              <div key={u.id} className="kv-line" style={{ padding: '8px 6px' }}>
                <span className="grow"><b>{u.full_name}</b> <span className="muted small">· {u.rejection_reason}</span></span>
                <button className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => approve(u)}>Approve after all</button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      {rejecting && (
        <RejectDialog
          person={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(m) => { toast(m); setRejecting(null); onChange() }}
        />
      )}
    </>
  )
}

export function RejectDialog({ person, onClose, onDone }: { person: User; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await usersApi.reject(person.id, reason)
      onDone(r.message)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Not now for ${person.full_name}?`}
      subtitle="They'll get an email with your reason. You can approve them later."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim() || busy} onClick={submit}>{busy ? 'Sending…' : 'Turn down'}</button>
        </>
      }
    >
      <label className="field">
        <span className="label">Reason <span className="muted">(sent to them by email)</span></span>
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. We couldn't confirm your details. Please speak to the temple office." />
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
