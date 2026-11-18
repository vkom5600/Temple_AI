import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bookingsApi } from '../../api/endpoints'
import { bookingLength, bookingRef, bookingSlot, STATUS_LABEL } from '../../lib/bookings'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import type { Booking, BookingDetail } from '../../types'

// M13 Request sent + My requests (designs: screens/39_M13, 48_M13 v2).
export default function MyBookingsPage() {
  const toast = useToast()
  const [params] = useSearchParams()
  const sentId = Number(params.get('sent')) || null
  const [mine, setMine] = useState<Booking[] | null>(null)
  const [sent, setSent] = useState<BookingDetail | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    bookingsApi.list().then((r) => setMine([...r.bookings].sort((a, b) => b.id - a.id))).catch((e: Error) => setError(e.message))
    if (sentId) bookingsApi.get(sentId).then(setSent).catch(() => {})
  }, [sentId])
  useEffect(load, [load])

  const cancel = async (b: Booking) => {
    try { toast((await bookingsApi.cancel(b.id)).message); load() } catch (err) { toast((err as Error).message) }
  }

  const s = sent?.booking
  return (
    <div className="m-wrap">
      <div className="m-subbar">
        <Link to="/staff" className="icon-btn" aria-label="Back"><Icon name="arrow-left" size={20} /></Link>
        <b>{s ? 'Request sent' : 'My bookings'}</b>
        <span />
      </div>

      {s && (
        <section className="sent-card">
          <span className="sent-tick"><Icon name="check" size={28} /></span>
          <h1>Request sent</h1>
          <span className="muted small">Ref ID: {bookingRef(s)}</span>
          <div className="sent-summary">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="ulabel">Booking summary</span>
              <span className={`pill ${STATUS_LABEL[s.status].cls}`}><span className="dot" /> {STATUS_LABEL[s.status].label}</span>
            </div>
            <b className="sent-title">{s.title}</b>
            <span className="row muted small" style={{ gap: 6 }}><Icon name="home" size={14} /> {s.resource_name}</span>
            <div className="kv"><Icon name="clock" size={16} /><span><b>{bookingSlot(s)}</b><small>{bookingLength(s)}</small></span></div>
            <div className="kv"><Icon name="users" size={16} /><span><b>{s.guests ?? 0} guests</b><small>{s.food ? 'Vegetarian food' : 'No food'}</small></span></div>
            <div className="kv"><Icon name="user" size={16} /><span><b>{s.contact_name}</b><small>{s.contact_phone}</small></span></div>
            <div className="free-ok" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 6 }}><Icon name="check-circle" size={16} /> Temple Rules agreed</span><b>{sent.rules.filter((r) => r.agreed).length} of {sent.rules.length}</b></div>
          </div>
          <p className="muted small center" style={{ margin: 0 }}><Icon name="alert" size={14} /> The chairman or a committee member will decide. You'll get a message here.</p>
        </section>
      )}

      <div className="m-sec"><h2>My requests</h2><span>{mine ? `${mine.filter((b) => b.status === 'pending').length} waiting` : ''}</span></div>
      <ErrorNote>{error}</ErrorNote>
      {!mine && !error && <Spinner />}
      {mine && !mine.length && <p className="muted">No requests yet.</p>}
      {mine?.map((b) => (
        <div key={b.id} className={`m-task ${b.status === 'approved' ? 's-grn' : b.status === 'pending' ? 's-saf' : b.status === 'declined' ? 's-red' : ''}`}>
          <div className="txt">
            <div className="t">{b.title} · {b.resource_name}</div>
            <div className="m">{bookingSlot(b)}</div>
            <span className={`pill ${STATUS_LABEL[b.status].cls}`} style={{ marginTop: 6 }}>{STATUS_LABEL[b.status].label}</span>
            {b.decision_note && <div className="m">“{b.decision_note}”</div>}
          </div>
          {(b.status === 'pending' || (b.status === 'approved' && new Date(b.starts_at) > new Date())) && (
            <button className="btn btn-outline btn-sm" onClick={() => cancel(b)}>Cancel</button>
          )}
        </div>
      ))}

      <Link to="/staff/book" className="btn btn-outline btn-big"><Icon name="plus" /> Book a hall or room</Link>
      <Link to="/staff" className="btn btn-primary btn-big">Back to Home</Link>
    </div>
  )
}
