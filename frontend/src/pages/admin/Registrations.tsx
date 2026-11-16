import { useState } from 'react'
import { usersApi } from '../../api/endpoints'
import { ROLE_LABELS, jobLabel } from '../../constants'
import { timeAgo } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { Avatar, ErrorNote, Modal } from '../../components/ui'
import type { User } from '../../types'

// Chairman's queue of self-registrations (pending) and ones turned down (rejected).
export default function Registrations({ pending, rejected, onChange }: { pending: User[]; rejected: User[]; onChange: () => void }) {
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

  if (!pending.length && !rejected.length) return null

  return (
    <section className="panel panel-attn">
      <div className="panel-head">
        <h2>Registrations</h2>
        <span className="muted small">{pending.length ? `${pending.length} waiting` : 'None waiting'}</span>
      </div>
      <ErrorNote>{error}</ErrorNote>

      {pending.length > 0 && (
        <div className="reg-list">
          {pending.map((u) => (
            <div key={u.id} className="reg-row">
              <Avatar name={u.full_name} />
              <div className="grow">
                <div className="strong">{u.full_name}</div>
                <div className="small">
                  Wants to join as <b>{u.role === 'staff' ? `${jobLabel(u)} (staff)` : ROLE_LABELS[u.role]}</b>
                </div>
                <div className="muted small">{[u.email, u.phone].filter(Boolean).join(' · ')} · registered {timeAgo(u.created_at)}</div>
              </div>
              <div className="reg-actions">
                <button className="btn btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => setRejecting(u)}>Reject</button>
                <button className="btn btn-success btn-sm" disabled={busyId === u.id} onClick={() => approve(u)}>
                  {busyId === u.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <>
          <button className="link-btn small" onClick={() => setShowRejected((s) => !s)}>
            {showRejected ? 'Hide' : 'Show'} {rejected.length} not approved
          </button>
          {showRejected && (
            <div className="reg-list">
              {rejected.map((u) => (
                <div key={u.id} className="reg-row muted-row">
                  <Avatar name={u.full_name} />
                  <div className="grow">
                    <div className="strong">{u.full_name} <span className="muted small">· {u.role === 'staff' ? jobLabel(u) : ROLE_LABELS[u.role]}</span></div>
                    <div className="muted small">Reason: {u.rejection_reason}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => approve(u)}>Approve after all</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {rejecting && (
        <RejectDialog
          person={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(message) => {
            setRejecting(null)
            toast(message)
            onChange()
          }}
        />
      )}
    </section>
  )
}

function RejectDialog({ person, onClose, onDone }: { person: User; onClose: () => void; onDone: (message: string) => void }) {
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
      title={`Reject ${person.full_name}?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim() || busy} onClick={submit}>{busy ? 'Rejecting…' : 'Reject'}</button>
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
