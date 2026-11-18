import { useCallback, useEffect, useState } from 'react'
import { bookingsApi } from '../../api/endpoints'
import { TASK_GROUP_LABELS } from '../../constants'
import { bookingLength, bookingRef, bookingSlot, STATUS_LABEL } from '../../lib/bookings'
import { fmtWhen } from '../../lib/format'
import { hhmm } from '../../lib/tasks'
import { useToast } from '../Toast'
import { ErrorNote, Icon, Modal, Spinner } from '../ui'
import type { BookingDetail } from '../../types'

// AC2 Booking review (designs: screens/12_AC2, 13_AC2): the request, the Temple Rules the
// requester agreed, the recommendation, and the prep tasks approval adds.
// Any committee member can decide.
export default function BookingReview({ bookingId, onClose, onChanged }: { bookingId: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [detail, setDetail] = useState<BookingDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'view' | 'reject' | 'ask' | 'cancel'>('view')
  const [note, setNote] = useState('')
  const [withTasks, setWithTasks] = useState(true)

  const load = useCallback(() => {
    bookingsApi.get(bookingId).then(setDetail).catch((e: Error) => setError(e.message))
  }, [bookingId])
  useEffect(load, [load])

  const run = async (action: () => Promise<{ message: string }>, close = true) => {
    setError('')
    setBusy(true)
    try {
      toast((await action()).message)
      onChanged()
      if (close) onClose()
      else { setMode('view'); setNote(''); load() }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const b = detail?.booking
  const check = detail?.check
  const pending = b?.status === 'pending'
  const agreedCount = detail?.rules.filter((r) => r.agreed).length ?? 0

  const footer = b && (
    mode === 'reject' || mode === 'ask' || mode === 'cancel' ? (
      <>
        <button className="btn btn-outline" onClick={() => { setMode('view'); setNote('') }}>Back</button>
        <button
          className={`btn ${mode === 'ask' ? 'btn-primary' : 'btn-danger'}`}
          disabled={(mode !== 'cancel' && !note.trim()) || busy}
          onClick={() => run(
            mode === 'reject' ? () => bookingsApi.decline(b.id, note.trim())
              : mode === 'ask' ? () => bookingsApi.ask(b.id, note.trim())
                : () => bookingsApi.cancel(b.id, note.trim() || undefined),
            mode !== 'ask',
          )}
        >
          {mode === 'reject' ? 'Reject and tell them' : mode === 'ask' ? 'Send question' : 'Cancel booking'}
        </button>
      </>
    ) : pending ? (
      <div className="stack" style={{ width: '100%', gap: 6 }}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {b.requested_by && <button className="btn btn-outline" onClick={() => setMode('ask')}><Icon name="message" size={16} /> Ask a question</button>}
          <button className="btn btn-red-outline" onClick={() => setMode('reject')}><Icon name="x" size={16} /> Reject</button>
          <button className="btn btn-act btn-lg" disabled={busy} onClick={() => run(() => bookingsApi.approve(b.id, withTasks))}>
            <Icon name="check" /> {withTasks && detail?.prep_tasks?.length ? `Approve and add ${detail.prep_tasks.length} tasks` : 'Approve'}
          </button>
        </div>
        <span className="muted small" style={{ textAlign: 'right' }}>Any committee member can decide</span>
      </div>
    ) : b.status === 'approved' ? (
      <button className="btn btn-red-outline push-left" onClick={() => setMode('cancel')}>Cancel this booking</button>
    ) : null
  )

  return (
    <Modal
      title="Booking request"
      size="wide"
      onClose={onClose}
      head={
        <div className="row" style={{ flexWrap: 'nowrap', gap: 14 }}>
          <span className="tile-ic" style={{ background: 'var(--ind-d)', color: '#fff' }}><Icon name="calendar" size={20} /></span>
          <div>
            <span className="ulabel" style={{ color: 'var(--saf-d)' }}>{b?.kind === 'event' ? 'Temple event' : b?.source === 'desk' ? 'Booking (office)' : 'Booking request'}</span>
            <h2 style={{ fontSize: 22 }}>{b ? `${b.title} – ${b.resource_name}` : 'Loading…'}</h2>
          </div>
        </div>
      }
      footer={footer}
    >
      {!detail && !error && <Spinner />}
      {b && (
        <>
          {!pending && (
            <div className="row">
              <span className={`pill ${STATUS_LABEL[b.status].cls}`}><span className="dot" /> {STATUS_LABEL[b.status].label}</span>
              {b.reviewed_by_name && <span className="muted small">by {b.reviewed_by_name}{b.reviewed_at && `, ${fmtWhen(b.reviewed_at)}`}</span>}
              <span className="muted small">Ref {bookingRef(b)}</span>
            </div>
          )}
          {b.decision_note && <div className="quote"><b><Icon name="message" size={16} /> {b.status === 'declined' ? 'Reason' : 'Note'}:</b><p>“{b.decision_note}”</p></div>}

          <div className="booking-facts">
            <div>
              <span className="ulabel">Requester</span>
              <b><Icon name="user" size={16} /> {b.contact_name ?? b.requested_by_name ?? '—'}</b>
              <small>{[b.organisation, b.guests != null && `${b.guests} guests`, b.contact_phone].filter(Boolean).join(' · ')}</small>
            </div>
            <div>
              <span className="ulabel">Date &amp; time</span>
              <b><Icon name="clock" size={16} /> {bookingSlot(b)}</b>
              <small>Duration: {bookingLength(b)}</small>
            </div>
            <div className="full">
              <span className="ulabel">Purpose &amp; food</span>
              <b><Icon name="calendar" size={16} /> {b.title} <span className="muted" style={{ fontWeight: 400 }}>· Food:</span> <span style={{ color: b.food ? 'var(--green)' : 'var(--ink-2)' }}>{b.food ? 'Vegetarian, served' : 'None'}</span></b>
              {b.notes && <small>{b.notes}</small>}
            </div>
          </div>

          {b.source === 'mobile' && detail.rules.length > 0 && (
            <section className="rules-card">
              <div className="dsec-head" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 16 }}>
                <span className="row" style={{ gap: 8 }}><Icon name="shield" size={18} /> Temple Rules – agreed by requester</span>
                <span className={`pill ${agreedCount === detail.rules.length ? 'pill-grn' : 'pill-red'}`}>✓ {agreedCount} of {detail.rules.length}{b.rules_agreed_at && ` · ${fmtWhen(b.rules_agreed_at)}`}</span>
              </div>
              <ol className="rules-grid">
                {detail.rules.map((r, i) => (
                  <li key={r.id} className={r.agreed ? 'ok' : 'no'}>
                    <span className="rule-tick">{r.agreed ? <Icon name="check" size={13} /> : <Icon name="x" size={13} />}</span>
                    {i + 1}. {r.text}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {check && pending && (
            <div className={`recommend ${check.recommendation}`}>
              <span className="star">✦</span> <b>Temple AI recommends:</b> {check.summary}
            </div>
          )}

          {pending && detail.prep_tasks && detail.prep_tasks.length > 0 && (
            <section className="prep">
              <label className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                <span className="ulabel">Approving adds these tasks</span>
                <span className="row muted small" style={{ gap: 6 }}><input type="checkbox" style={{ width: 16, height: 16, minHeight: 0 }} checked={withTasks} onChange={(e) => setWithTasks(e.target.checked)} /> Add them</span>
              </label>
              <ol className={withTasks ? '' : 'off'}>
                {detail.prep_tasks.map((t, i) => (
                  <li key={i}>
                    <span className="n">{i + 1}</span>
                    <span className="grow"><b>{t.title}</b><small>{TASK_GROUP_LABELS[t.assigned_group]} on duty · {i === detail.prep_tasks!.length - 1 ? 'after' : 'by'} {hhmm(t.due_at)}</small></span>
                    {t.requires_verification && <span className="tag tag-saf">Needs a second check</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {detail.tasks && detail.tasks.length > 0 && (
            <section className="prep">
              <span className="ulabel">Prep tasks</span>
              <ol>
                {detail.tasks.map((t, i) => (
                  <li key={t.id}>
                    <span className="n">{i + 1}</span>
                    <span className="grow"><b>{t.title}</b><small>{t.assigned_group ? TASK_GROUP_LABELS[t.assigned_group] : ''} · {hhmm(t.due_at)} · {t.status === 'done' ? 'done' : t.status === 'cancelled' ? 'cancelled' : 'to do'}</small></span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {mode === 'reject' && (
            <label className="field"><span className="label">Why? <span className="muted">(sent to them)</span></span>
              <textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. The hall is needed for Diwali that evening. Could you choose another day?" />
            </label>
          )}
          {mode === 'ask' && (
            <label className="field"><span className="label">Your question <span className="muted">(goes to {b.requested_by_name}'s phone; the request keeps waiting)</span></span>
              <textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Will there be a PA system? How many tables do you need?" />
            </label>
          )}
          {mode === 'cancel' && (
            <label className="field"><span className="label">Reason <span className="muted">(optional; prep tasks not done yet are cancelled too)</span></span>
              <textarea rows={2} autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </label>
          )}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
