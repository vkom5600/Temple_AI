import { useState } from 'react'
import { useStore } from '../store.jsx'
import { BOOKABLE } from '../data'
import { bookingTasks, assigneeLabel, fmtWhen, fmtDay, fmtTime, isFinished } from '../lib'
import { Icon, Modal, Badge } from '../ui.jsx'
import { suggestBookingTasks } from '../assistant'

const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA') }

export default function Bookings() {
  const { s } = useStore()
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState('month')
  const todayStr = new Date().toLocaleDateString('en-CA')
  const list = [...s.bookings].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const upcoming = list.filter((b) => b.date >= todayStr)
  const past = list.filter((b) => b.date < todayStr)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="muted">Bookings, festivals and tasks in one place. Adding a booking creates its preparation tasks.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New booking</button>
      </header>

      <div className="toolbar">
        <div className="seg seg-inline">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <Connection name="Google Calendar" note="Will sync bookings and festivals both ways once the backend is built. Showing sample data for now." />
      </div>

      {view === 'month' ? (
        <MonthView />
      ) : (
        <div className="stack">
          {upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
          {past.length > 0 && <h2 className="eyebrow">Past</h2>}
          {past.map((b) => <BookingRow key={b.id} b={b} />)}
        </div>
      )}

      {creating && <NewBooking onClose={() => setCreating(false)} />}
    </div>
  )
}

// Status of an outside service (Google Calendar, SharePoint). Not connected until the backend exists.
export function Connection({ name, note }) {
  return (
    <span className="connection" title={note}>
      <span className="dot" /> {name}: not connected yet
    </span>
  )
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const key = (d) => d.toLocaleDateString('en-CA')

function MonthView() {
  const { s } = useStore()
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const todayKey = key(new Date())
  const [picked, setPicked] = useState(todayKey)

  // Grid starts on the Monday on or before the 1st, and runs 6 weeks.
  const start = new Date(month)
  start.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })

  const on = (k) => ({
    bookings: s.bookings.filter((b) => b.date === k).sort((a, b) => a.start.localeCompare(b.start)),
    festivals: s.observances.filter((o) => o.date === k),
    tasks: s.tasks.filter((t) => key(new Date(t.due)) === k),
  })
  const shift = (n) => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + n); return d })
  const sel = on(picked)

  return (
    <div className="cal-wrap">
      <section className="panel cal">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <h2>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">›</button>
          <button className="link-btn" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); setPicked(todayKey) }}>Today</button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {days.map((d) => {
            const k = key(d)
            const x = on(k)
            const cls = ['cal-day', d.getMonth() !== month.getMonth() && 'out', k === todayKey && 'today', k === picked && 'picked'].filter(Boolean).join(' ')
            return (
              <button key={k} className={cls} onClick={() => setPicked(k)}>
                <span className="cal-num">{d.getDate()}</span>
                {x.festivals.map((o) => <span key={o.id} className="cal-item cal-fest">{o.name}</span>)}
                {x.bookings.slice(0, 2).map((b) => <span key={b.id} className="cal-item cal-book">{b.start} {b.title}</span>)}
                {x.bookings.length > 2 && <span className="cal-more">+{x.bookings.length - 2} more</span>}
                {x.tasks.length > 0 && <span className="cal-tasks">{x.tasks.length} task{x.tasks.length > 1 ? 's' : ''}</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel cal-side">
        <div className="panel-head">
          <h2>{new Date(`${picked}T00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        </div>
        {sel.festivals.map((o) => <div key={o.id} className="festival strong">{o.name}{o.sample && <span className="sample">sample</span>}</div>)}
        {sel.bookings.length > 0 && (
          <div className="stack-tight">
            <span className="lane-label">Bookings</span>
            {sel.bookings.map((b) => {
              const prep = s.tasks.filter((t) => t.source?.bookingId === b.id)
              return (
                <div key={b.id}>
                  <div><b>{b.start}–{b.end}</b> {b.title}</div>
                  <div className="meta">{b.space}{prep.length ? ` · prep ${prep.filter(isFinished).length}/${prep.length} done` : ''}</div>
                </div>
              )
            })}
          </div>
        )}
        {sel.tasks.length > 0 && (
          <div className="stack-tight">
            <span className="lane-label">Tasks</span>
            {sel.tasks.sort((a, b) => new Date(a.due) - new Date(b.due)).map((t) => (
              <div key={t.id} className={isFinished(t) ? 'past' : ''}><b>{fmtTime(t.due)}</b> {t.title}</div>
            ))}
          </div>
        )}
        {!sel.festivals.length && !sel.bookings.length && !sel.tasks.length && <p className="muted">Nothing on this day.</p>}
      </section>
    </div>
  )
}

function BookingRow({ b }) {
  const { s } = useStore()
  const tasks = s.tasks.filter((t) => t.source?.bookingId === b.id)
  const done = tasks.filter((t) => ['done', 'verified'].includes(t.status)).length
  const date = new Date(`${b.date}T${b.start}`)
  return (
    <div className="card booking">
      <div className="date-chip big">
        <span>{date.getDate()}</span>
        <small>{date.toLocaleDateString([], { month: 'short' })}</small>
      </div>
      <div className="grow">
        <div className="task-title">{b.title}</div>
        <div className="meta">{fmtDay(date.toISOString())} · {b.start}–{b.end} · {b.space} · Contact: {b.contact || '—'}{b.phone ? `, ${b.phone}` : ''}{b.email ? `, ${b.email}` : ''}</div>
      </div>
      {tasks.length > 0 ? <Badge tone={done === tasks.length ? 'green' : 'blue'}>{done}/{tasks.length} prep tasks done</Badge> : <Badge>No prep tasks</Badge>}
    </div>
  )
}

function NewBooking({ onClose }) {
  const { s, act, newId } = useStore()
  const [f, setF] = useState({ space: 'Shivaji Hall', title: '', contact: '', phone: '', email: '', date: tomorrow(), start: '18:00', end: '21:00', puja: false })
  const [step, setStep] = useState(1)
  const [picked, setPicked] = useState([])
  const [aiPicked, setAiPicked] = useState([])
  const phoneOk = !f.phone.trim() || /^\+?[\d\s()-]{7,}$/.test(f.phone.trim())
  const emailOk = !f.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())
  const clean = { ...f, title: f.title.trim(), contact: f.contact.trim(), phone: f.phone.trim(), email: f.email.trim() }
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const clash = s.bookings.find((b) => b.space === f.space && b.date === f.date && b.start < f.end && f.start < b.end)
  const tooLate = f.end > '22:00'
  const preview = bookingTasks({ ...clean, id: 'preview' })
  const ai = step === 2 ? suggestBookingTasks(clean, s) : []

  const next = () => { setPicked(preview.map(() => true)); setAiPicked(suggestBookingTasks(clean, s).map(() => false)); setStep(2) }
  const confirm = () => {
    const id = newId('b')
    const link = (t) => ({ kind: 'booking', category: 'Events & bookings', notes: `For booking: ${clean.title} (${clean.contact})`, ...t, source: { bookingId: id } })
    const tasks = [
      ...bookingTasks({ ...clean, id }).filter((_, i) => picked[i]),
      ...ai.filter((_, i) => aiPicked[i]).map(({ reason, ...t }) => link(t)),
    ]
    act({ type: 'addBooking', booking: { ...clean, id }, tasks, log: `Booked ${f.space} for "${f.title}" and assigned ${tasks.length} prep tasks`, toast: `Booking saved. ${tasks.length} tasks assigned.` })
    onClose()
  }

  return (
    <Modal
      title={step === 1 ? 'New booking' : 'Preparation tasks'}
      onClose={onClose}
      wide
      footer={
        step === 1 ? (
          <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!f.title.trim() || !f.contact.trim() || !phoneOk || !emailOk || !!clash || f.end <= f.start} onClick={next}>Next: review tasks</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={confirm}>Save booking and assign {picked.filter(Boolean).length + aiPicked.filter(Boolean).length} tasks</button>
          </>
        )
      }
    >
      {step === 1 ? (
        <>
          <div className="form-grid">
            <label className="field">
              <span className="label">Hall / room</span>
              <select value={f.space} onChange={(e) => set('space', e.target.value)}>{BOOKABLE.map((b) => <option key={b}>{b}</option>)}</select>
            </label>
            <label className="field">
              <span className="label">What is it for?</span>
              <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Birthday puja (Shah family)" autoFocus />
            </label>
            <label className="field">
              <span className="label">Contact name</span>
              <input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="e.g. Mr Shah" />
            </label>
            <label className="field">
              <span className="label">Contact phone <span className="muted">(optional)</span></span>
              <input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7…" />
              {!phoneOk && <span className="red small">That number doesn't look right.</span>}
            </label>
            <label className="field">
              <span className="label">Contact email <span className="muted">(optional)</span></span>
              <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
              {!emailOk && <span className="red small">That email doesn't look right.</span>}
            </label>
            <label className="field">
              <span className="label">Date</span>
              <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Starts</span>
              <input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Ends</span>
              <input type="time" value={f.end} onChange={(e) => set('end', e.target.value)} />
            </label>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={f.puja} onChange={(e) => set('puja', e.target.checked)} />
            <span><b>Includes a puja</b> <span className="muted small">Adds a task for the priest.</span></span>
          </label>
          {clash && <div className="warn"><Icon name="alert" size={16} /> {f.space} is already booked then for "{clash.title}" ({clash.start}–{clash.end}).</div>}
          {tooLate && <div className="warn"><Icon name="alert" size={16} /> Sample rule R2: hall bookings must finish by 10pm.</div>}
          {!f.contact.trim() && <div className="hint"><Icon name="alert" size={14} /> A contact name is needed (sample rule R2).</div>}
        </>
      ) : (
        <>
          <p className="muted">These tasks will be created and sent to each role. Untick any you don't need.</p>
          <div className="stack">
            {preview.map((t, i) => (
              <label key={i} className="check-row">
                <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                <div className="grow">
                  <div>{t.title} {t.critical && <Badge tone="amber">Sign-off</Badge>}</div>
                  <div className="meta">{assigneeLabel(t.assignee, s.users)} · {fmtWhen(t.due)}</div>
                </div>
              </label>
            ))}
          </div>
          {ai.length > 0 && (
            <div className="ai-suggest">
              <div className="ai-suggest-head">
                <Icon name="sparkle" size={16} /> <b>Suggested by AI</b> <Badge tone="blue">demo</Badge>
                <span className="muted small">Not added unless you tick them</span>
              </div>
              {ai.map((t, i) => (
                <label key={i} className="check-row">
                  <input type="checkbox" checked={!!aiPicked[i]} onChange={(e) => setAiPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                  <div className="grow">
                    <div>{t.title}</div>
                    <div className="meta">{assigneeLabel(t.assignee, s.users)} · {fmtWhen(t.due)}</div>
                    <div className="why">Why: {t.reason}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
