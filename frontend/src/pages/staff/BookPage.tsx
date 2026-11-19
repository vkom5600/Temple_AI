import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bookingsApi, publicApi, resourcesApi, rulesApi } from '../../api/endpoints'
import EntryShell from '../../components/EntryShell'
import { useAuth } from '../../auth/AuthContext'
import { BRAND } from '../../branding'
import { bookingDay, bookingTimes, toIso } from '../../lib/bookings'
import { toDateInput } from '../../lib/format'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import type { Resource, TempleRule } from '../../types'
import { ukAddDays } from '../../lib/uk'

// M7 Request a booking (design: screens/38_M7, final review p.25): the phone booking.
// The person ticks every Temple Rule before Send unlocks ("4 of 6 agreed"); the request
// then waits for the chairman or a committee member (AC2).
export default function BookPage({ publicMode = false }: { publicMode?: boolean }) {
  const { user } = useAuth()
  const [sent, setSent] = useState<{ reference: string; message: string; booking: { title: string; resource_name: string; starts_at: string; ends_at: string; guests: number | null } } | null>(null)
  const [trap, setTrap] = useState('') // hidden field; only bots fill it in
  const navigate = useNavigate()
  const [resources, setResources] = useState<Pick<Resource, 'id' | 'name' | 'kind' | 'capacity'>[] | null>(null)
  const [rules, setRules] = useState<Pick<TempleRule, 'id' | 'text'>[]>([])
  const tomorrow = ukAddDays(new Date(), 1)
  const [f, setF] = useState({
    title: '', resource_id: 0, date: toDateInput(tomorrow), start: '14:00', end: '18:00', guests: '',
    food: true, contact_name: user?.full_name ?? '', contact_phone: user?.phone ?? '',
  })
  const [agreed, setAgreed] = useState<Set<number>>(new Set())
  const [free, setFree] = useState<{ free: boolean; problems: string[]; clashes: { title: string }[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (publicMode) {
      publicApi.options().then((r) => { setResources(r.resources); setRules(r.rules) }).catch(() => setResources([]))
      return
    }
    resourcesApi.list().then((r) => setResources(r.resources.filter((s) => s.kind === 'hall' || s.kind === 'room'))).catch(() => setResources([]))
    rulesApi.list().then((r) => setRules(r.rules.filter((x) => x.ask_requester))).catch(() => {})
  }, [publicMode])

  useEffect(() => {
    if (!f.resource_id || !f.date || f.end <= f.start) { setFree(null); return }
    const id = setTimeout(() => {
      const input = { resource_id: f.resource_id, starts_at: toIso(f.date, f.start), ends_at: toIso(f.date, f.end), guests: Number(f.guests) || null }
      ;(publicMode
        ? publicApi.check(input).then((r) => setFree({ free: r.free, problems: r.problems, clashes: [] }))
        : bookingsApi.check(input).then(setFree)
      ).catch(() => setFree(null))
    }, 300)
    return () => clearTimeout(id)
  }, [f.resource_id, f.date, f.start, f.end, f.guests, publicMode])

  const allAgreed = rules.length > 0 && rules.every((r) => agreed.has(r.id))
  const canSend = f.title.trim() && f.resource_id && f.date && f.end > f.start && f.contact_name.trim() && f.contact_phone.trim() &&
    allAgreed && free?.free !== false && !busy
  const toggle = (id: number) => setAgreed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const send = async () => {
    setError('')
    setBusy(true)
    try {
      if (publicMode) {
        const r = await publicApi.request({
          resource_id: f.resource_id, title: f.title.trim(), starts_at: toIso(f.date, f.start), ends_at: toIso(f.date, f.end),
          guests: f.guests === '' ? null : Number(f.guests), food: f.food,
          contact_name: f.contact_name.trim(), contact_phone: f.contact_phone.trim(), rules_agreed: [...agreed], website: trap,
        })
        setSent(r)
        window.scrollTo(0, 0)
        return
      }
      const r = await bookingsApi.create({
        resource_id: f.resource_id, title: f.title.trim(), starts_at: toIso(f.date, f.start), ends_at: toIso(f.date, f.end),
        guests: f.guests === '' ? null : Number(f.guests), food: f.food,
        contact_name: f.contact_name.trim(), contact_phone: f.contact_phone.trim(), rules_agreed: [...agreed],
      })
      navigate(`/staff/bookings?sent=${r.booking.id}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  if (publicMode && sent) {
    return (
      <EntryShell>
        <div className="stack center" role="status" style={{ paddingTop: 16 }}>
          <span className="tile-ic ic-grn" style={{ margin: '0 auto', width: 64, height: 64, borderRadius: '50%' }}><Icon name="check" size={30} /></span>
          <h1>Request sent</h1>
          <p className="lead" style={{ margin: 0 }}>{sent.message}</p>
        </div>
        <section className="jcard" style={{ marginTop: 18 }}>
          <h2><Icon name="calendar" size={17} /> Your request <span className="push-left" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--saf-d)' }}>Ref: {sent.reference}</span></h2>
          <dl className="signup-answers" style={{ background: 'none', border: 0, padding: 0 }}>
            <dt>For</dt><dd>{sent.booking.title}</dd>
            <dt>Where</dt><dd>{sent.booking.resource_name}</dd>
            <dt>When</dt><dd>{bookingDay(sent.booking.starts_at)}, {bookingTimes(sent.booking)}</dd>
            {sent.booking.guests != null && <><dt>Guests</dt><dd>{sent.booking.guests}</dd></>}
          </dl>
        </section>
        <p className="fine"><Icon name="phone" size={13} /> Keep the reference. If anything changes, call the temple office and quote it.</p>
        <button className="btn btn-outline btn-big" onClick={() => { setSent(null); setAgreed(new Set()); set('title', '') }}>Make another request</button>
      </EntryShell>
    )
  }

  const body = (
    <>

      <label className="field"><span className="label">What is it for?</span>
        <input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder="e.g. Birthday puja" />
      </label>

      <div className="field">
        <span className="label">Hall or room</span>
        {!resources ? <Spinner /> : (
          <div className="tiles">
            {resources.map((r) => (
              <button key={r.id} type="button" className={`tile ${f.resource_id === r.id ? 'on' : ''}`} onClick={() => set('resource_id', r.id)}>
                <b>{r.name}</b><span>{r.capacity ? `Up to ${r.capacity} people` : r.kind === 'hall' ? 'Hall' : 'Room'}</span>
                {f.resource_id === r.id && <i className="tile-check"><Icon name="check" size={12} /></i>}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="field"><span className="label">Date</span><input type="date" value={f.date} min={toDateInput(new Date())} onChange={(e) => set('date', e.target.value)} /></label>
      <div className="grid-2f" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label className="field"><span className="label">From</span><input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} /></label>
        <label className="field"><span className="label">To</span><input type="time" value={f.end} onChange={(e) => set('end', e.target.value)} /></label>
      </div>
      <label className="field"><span className="label">Guests</span><input type="number" min={0} inputMode="numeric" value={f.guests} onChange={(e) => set('guests', e.target.value)} placeholder="e.g. 80" /></label>
      {free && (free.free && !free.problems.length
        ? <div className="free-ok"><Icon name="check-circle" size={16} /> Free at that time</div>
        : <div className="free-no"><Icon name="alert" size={16} /> {free.free ? free.problems.join(' · ') : `Already booked then (${free.clashes[0]?.title})`}</div>)}

      <div className="field">
        <span className="row" style={{ justifyContent: 'space-between' }}><span className="label">Food?</span><span className="pill pill-grn">Vegetarian only</span></span>
        <div className="segmented">
          <button type="button" className={f.food ? 'on' : ''} onClick={() => set('food', true)}>{f.food && '✓ '}Yes</button>
          <button type="button" className={!f.food ? 'on' : ''} onClick={() => set('food', false)}>No</button>
        </div>
        {f.food && <span className="muted small">External pure-veg catering must get kitchen clearance first.</span>}
      </div>

      {publicMode && <input className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />}
      <label className="field"><span className="label">{publicMode ? 'Your name and mobile' : 'Contact name'}</span>
        <span className="ifield"><Icon name="user" /><input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></span>
      </label>
      <label className="field">{!publicMode && <span className="label">Mobile phone</span>}
        <span className="ifield"><Icon name="phone" /><input type="tel" value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="+44 7…" /></span>
      </label>

      <section className="rules-check">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b className="row" style={{ gap: 8 }}><span className="star">✦</span> Temple Rules for this booking</b>
        </div>
        <span className="muted small">From the written Temple Rules. Please read and tick each one.</span>
        <span className={`pill ${allAgreed ? 'pill-grn' : 'pill-saf'}`} style={{ alignSelf: 'flex-start' }}>{agreed.size} of {rules.length} agreed</span>
        {rules.map((r) => {
          const [first, ...rest] = r.text.split('. ')
          return (
            <label key={r.id} className={`check ${agreed.has(r.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={agreed.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="cb">{agreed.has(r.id) && <Icon name="check" size={16} />}</span>
              <span><b>{first}{rest.length ? '' : ''}</b>{rest.length > 0 && <span>{rest.join('. ')}</span>}</span>
            </label>
          )
        })}
      </section>

      <ErrorNote>{error}</ErrorNote>
      {!allAgreed && <p className="fine" style={{ margin: 0 }}><Icon name="lock" size={14} /> Tick all rules to send</p>}
      <button className={`btn btn-big ${publicMode ? 'btn-act' : 'btn-primary'}`} disabled={!canSend} onClick={send}><Icon name="send" size={18} /> {busy ? 'Sending…' : 'Send request'}</button>
      {publicMode && <p className="fine" style={{ margin: 0 }}>Send unlocks when all rules are ticked. Nothing is booked until a committee member approves it.</p>}
    </>
  )

  if (publicMode) {
    return (
      <EntryShell>
        <h1>Book a hall or room</h1>
        <p className="lead">Send a request. Nothing is booked until a committee member approves it.</p>
        <div className="stack" style={{ gap: 16 }}>{body}</div>
        <p className="fine">Already part of the temple team? <Link to="/login">Sign in</Link></p>
      </EntryShell>
    )
  }

  return (
    <div className="m-wrap">
      <div className="m-subbar">
        <Link to="/staff" className="icon-btn" aria-label="Back"><Icon name="arrow-left" size={20} /></Link>
        <b>Request a booking</b>
        <Link to="/staff" className="link-btn">Cancel</Link>
      </div>

      <div className="left-card">
        <span className="tile-ic ic-ind"><Icon name="home" size={20} /></span>
        <div><b>{BRAND.templeName}</b><div className="muted small">Please share the event details for the committee and priests to approve.</div></div>
      </div>
      {body}
    </div>
  )
}
