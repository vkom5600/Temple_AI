import { useEffect, useState } from 'react'
import { attendanceApi, notificationsApi, usersApi } from '../api/endpoints'
import { DESIGNATION_LABELS } from '../constants'
import { useToast } from './Toast'
import { Avatar, ErrorNote, Icon, Modal } from './ui'
import type { BroadcastAudience, Designation, User } from '../types'

// H3 Broadcast (design: screens/06_H3_broadcast): one message to staff and volunteer phones.
// It shows at the top of their phone as "Message from Raghu"; urgent ones in red.
const AUDIENCES: { id: BroadcastAudience; label: string }[] = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'staff', label: 'All staff' },
  { id: 'volunteer', label: 'All volunteers' },
  { id: 'committee', label: 'Committee' },
]
const MAX = 280

export default function BroadcastDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [people, setPeople] = useState<User[]>([])
  const [onSite, setOnSite] = useState<Set<number>>(new Set())
  const [audience, setAudience] = useState<BroadcastAudience>('staff')
  const [jobs, setJobs] = useState<Designation[]>([])
  const [message, setMessage] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    usersApi.list().then((r) => setPeople(r.users.filter((u) => u.is_active && u.approval_status === 'approved'))).catch(() => {})
    attendanceApi.day().then((d) => setOnSite(new Set(d.people.filter((p) => p.state === 'here').map((p) => p.user_id)))).catch(() => {})
  }, [])

  const roles: Record<BroadcastAudience, string[]> = {
    everyone: ['staff', 'volunteer', 'committee', 'chairman'],
    staff: ['staff'],
    volunteer: ['volunteer'],
    committee: ['committee', 'chairman'],
  }
  const reach = (jobs.length
    ? people.filter((p) => p.designation && jobs.includes(p.designation))
    : people.filter((p) => roles[audience].includes(p.role))
  )
  const onDuty = reach.filter((p) => onSite.has(p.id)).length

  const send = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await notificationsApi.broadcast({ audience, designations: jobs, message: message.trim(), urgent })
      toast(r.message)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Broadcast"
      subtitle="Send an announcement to staff and volunteers"
      size="wide"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline push-left" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!message.trim() || !reach.length || busy} onClick={send}>
            <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send broadcast'}
          </button>
        </>
      }
    >
      <div className="broadcast-top" aria-hidden="true" />
      <div className="field">
        <span className="ulabel">Recipients</span>
        <div className="fchips">
          {AUDIENCES.map((a) => (
            <button key={a.id} type="button" className={`fchip ${audience === a.id && !jobs.length ? 'on' : ''}`} onClick={() => { setAudience(a.id); setJobs([]) }}>{a.label}</button>
          ))}
        </div>
      </div>
      {audience === 'staff' && (
        <div className="field">
          <span className="muted small">Or only some jobs:</span>
          <div className="chips">
            {(Object.keys(DESIGNATION_LABELS) as Designation[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`chip ${jobs.includes(d) ? 'on' : ''}`}
                onClick={() => setJobs((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
              >
                {DESIGNATION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="reach">
        <span className="reach-faces">
          {reach.slice(0, 3).map((p) => <Avatar key={p.id} name={p.full_name} size={30} />)}
          {reach.length > 3 && <span className="reach-more">+{reach.length - 3}</span>}
        </span>
        <span className="grow">Will reach <b>{reach.length} {reach.length === 1 ? 'person' : 'people'}</b></span>
        {onDuty > 0 && <span className="pill pill-grn"><span className="dot" /> {onDuty} on duty now</span>}
      </div>

      <label className="field">
        <span className="row" style={{ justifyContent: 'space-between' }}>
          <span className="ulabel">Message</span>
          <span className="muted small">{message.length} / {MAX}</span>
        </span>
        <textarea rows={4} maxLength={MAX} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus placeholder="e.g. Please make sure the Main Hall doors are locked after Aarti and the prasad counters are filled…" />
      </label>

      <div className="urgent-row">
        <span className="tile-ic" style={{ background: '#fff', border: '1px solid var(--line)' }}><Icon name="bell" size={20} /></span>
        <div className="grow">
          <b>Mark as urgent</b>
          <span className="muted small block">Shows in red at the top of their phone and asks them to confirm they've read it.</span>
        </div>
        <button className={`switch ${urgent ? 'on' : ''}`} role="switch" aria-checked={urgent} aria-label="Mark as urgent" onClick={() => setUrgent((u) => !u)}><span className="switch-knob" /></button>
      </div>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
