import { useEffect, useState } from 'react'
import { bookingsApi, resourcesApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { bookingDay, toIso } from '../../lib/bookings'
import { toDateInput } from '../../lib/format'
import { useToast } from '../Toast'
import { ErrorNote, Icon, Modal } from '../ui'
import type { Resource } from '../../types'

// C4 Add to calendar (design: screens/25_C4) – the office books from the tablet or computer.
// Confirmed straight away. "Booking" = someone hires a space; "Temple event" = the temple runs it.
export interface BookingDraft { date?: string; start?: string; end?: string; resource_id?: number }

export default function BookingForm({ draft = {}, onClose, onSaved }: { draft?: BookingDraft; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [resources, setResources] = useState<Resource[]>([])
  const [kind, setKind] = useState<'booking' | 'event'>('booking')
  const [f, setF] = useState({
    title: '',
    resource_id: draft.resource_id ?? 0,
    date: draft.date ?? toDateInput(new Date()),
    start: draft.start ?? '16:00',
    end: draft.end ?? '19:00',
    guests: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    organisation: '',
    deposit_paid: false,
    notify_staff: true,
  })
  const [free, setFree] = useState<{ free: boolean; clashes: { title: string }[]; problems: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    resourcesApi.list().then((r) => {
      setResources(r.resources)
      setF((x) => (x.resource_id ? x : { ...x, resource_id: r.resources.find((s) => s.kind === 'hall')?.id ?? r.resources[0]?.id ?? 0 }))
    }).catch(() => {})
  }, [])

  // "✓ Community Hall is free on Sat 14 Nov, 16:00–19:00"
  useEffect(() => {
    if (!f.resource_id || !f.date || !f.start || !f.end || f.end <= f.start) { setFree(null); return }
    const id = setTimeout(() => {
      bookingsApi.check({ resource_id: f.resource_id, starts_at: toIso(f.date, f.start), ends_at: toIso(f.date, f.end), guests: Number(f.guests) || null })
        .then(setFree).catch(() => setFree(null))
    }, 300)
    return () => clearTimeout(id)
  }, [f.resource_id, f.date, f.start, f.end, f.guests])

  const space = resources.find((r) => r.id === f.resource_id)
  const booking = kind === 'booking'
  const canSave = f.title.trim() && f.resource_id && f.date && f.start && f.end && f.end > f.start &&
    (!booking || (f.contact_name.trim() && f.contact_phone.trim())) && free?.free !== false && !busy

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await bookingsApi.create({
        kind,
        resource_id: f.resource_id,
        title: f.title.trim(),
        starts_at: toIso(f.date, f.start),
        ends_at: toIso(f.date, f.end),
        guests: f.guests === '' ? null : Number(f.guests),
        food: false,
        contact_name: booking ? f.contact_name.trim() : user?.full_name ?? '',
        contact_phone: booking ? f.contact_phone.trim() : '',
        contact_email: f.contact_email.trim() || undefined,
        organisation: f.organisation.trim() || undefined,
        deposit_paid: f.deposit_paid,
        notify_staff: f.notify_staff,
      })
      toast(r.message)
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Add to calendar"
      size="wide"
      onClose={onClose}
      footer={
        <>
          <span className="muted small push-left">Logged by {user?.full_name.split(' ')[0]} · confirmed straight away</span>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!canSave} onClick={save}>{busy ? 'Saving…' : booking ? 'Save booking' : 'Save event'}</button>
        </>
      }
    >
      <div className="field">
        <div className="segmented" style={{ maxWidth: 300 }}>
          <button type="button" className={booking ? 'on' : ''} onClick={() => setKind('booking')}>Booking</button>
          <button type="button" className={!booking ? 'on' : ''} onClick={() => setKind('event')}>Temple event</button>
        </div>
        <span className="muted small">Booking = someone hires a hall or room. Temple event = festivals, pujas and meetings the temple runs.</span>
      </div>

      <div className="cols-2">
        <div className="col">
          <span className="ulabel">{booking ? 'The booking' : 'The event'}</span>
          <label className="field"><span className="label">What it's for <span className="star">✦</span></span>
            <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={booking ? 'e.g. Birthday celebration' : 'e.g. Diwali Lakshmi Puja'} maxLength={200} autoFocus />
          </label>
          <label className="field"><span className="label">Space <span className="star">✦</span></span>
            <select value={f.resource_id} onChange={(e) => set('resource_id', Number(e.target.value))}>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (up to ${r.capacity})` : ''}</option>)}
            </select>
          </label>
          <div className="grid-2f">
            <label className="field"><span className="label">Date</span><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label className="field"><span className="label">Guests</span><input type="number" min={0} value={f.guests} onChange={(e) => set('guests', e.target.value)} placeholder="e.g. 40" /></label>
          </div>
          <div className="grid-2f">
            <label className="field"><span className="label">From</span><input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} /></label>
            <label className="field"><span className="label">To</span><input type="time" value={f.end} onChange={(e) => set('end', e.target.value)} /></label>
          </div>
          {free && (
            free.free && !free.problems.length ? (
              <div className="free-ok"><Icon name="check-circle" size={16} /> {space?.name} is free on {bookingDay(toIso(f.date, f.start))}, {f.start}–{f.end}</div>
            ) : (
              <div className="free-no"><Icon name="alert" size={16} /> {free.free ? free.problems.join(' · ') : `${space?.name} is already booked then (${free.clashes[0]?.title})`}</div>
            )
          )}
        </div>

        <div className="col">
          {booking ? (
            <>
              <span className="ulabel">Who's booking</span>
              <label className="field"><span className="label">Name <span className="star">✦</span></span><input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="e.g. Mrs Patel" /></label>
              <label className="field"><span className="label">Phone <span className="star">✦</span></span><input type="tel" value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="07…" /></label>
              <label className="field"><span className="label">Email <span className="muted">(optional, gets the confirmation)</span></span><input type="email" value={f.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="e.g. patel@example.com" /></label>
              <label className="field"><span className="label">Organisation <span className="muted">(optional)</span></span><input value={f.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="e.g. Family, Community group" /></label>
              <div className="field"><span className="label">Deposit</span>
                <div className="segmented" style={{ maxWidth: 260 }}>
                  <button type="button" className={!f.deposit_paid ? 'on' : ''} onClick={() => set('deposit_paid', false)}>Not paid yet</button>
                  <button type="button" className={f.deposit_paid ? 'on' : ''} onClick={() => set('deposit_paid', true)}>Paid</button>
                </div>
              </div>
              <div className="rule-tip"><Icon name="shield" size={16} /> Temple rule: hall bookings need a named contact and a deposit, and must finish by 9 pm on weekdays (10 pm at weekends).</div>
            </>
          ) : (
            <>
              <span className="ulabel">Notes</span>
              <p className="muted" style={{ margin: 0 }}>Temple events show on the calendar and on staff phones under "Today at the temple".</p>
            </>
          )}
        </div>
      </div>

      <label className="checkline" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <input type="checkbox" checked={f.notify_staff} onChange={(e) => set('notify_staff', e.target.checked)} />
        <span><b>Tell the cleaner, caretaker and security</b><span>Adds the prep tasks: clean before, set up, check and lock up after.</span></span>
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
