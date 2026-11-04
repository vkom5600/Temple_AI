import { useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, AREAS, TEMPLATES, CATEGORIES } from '../data'
import { categoryOf } from '../lib'
import { Modal } from '../ui.jsx'

const pad = (n) => String(n).padStart(2, '0')
const localDate = (d) => d.toLocaleDateString('en-CA')
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export default function TaskForm({ title = 'New task', initial = {}, onClose, onSave, showTemplates }) {
  const { s } = useStore()
  const due = initial.due ? new Date(initial.due) : (() => { const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0); return d })()
  const [f, setF] = useState({
    title: '',
    assignee: { type: 'role', id: 'priest' },
    area: 'Main Mandir',
    kind: 'one-off',
    priority: 'normal',
    critical: false,
    notes: '',
    ...initial,
    bookingId: initial.source?.bookingId ?? '',
    date: localDate(due),
    time: localTime(due),
  })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const known = (c) => CATEGORIES.includes(c) && c !== 'Other'
  const startCat = initial.category ?? (initial.assignee ? categoryOf({ kind: 'one-off', ...initial }, s.users) : 'General')
  const [cat, setCat] = useState(known(startCat) ? startCat : 'Other')
  const [otherCat, setOtherCat] = useState(known(startCat) ? '' : startCat === 'Other' ? '' : startCat)
  const todayStr = localDate(new Date())
  const bookings = s.bookings.filter((b) => b.date >= todayStr || b.id === f.bookingId).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))

  const linkBooking = (id) => {
    const b = s.bookings.find((x) => x.id === id)
    setF((x) => ({ ...x, bookingId: id, ...(b ? { area: b.space, date: b.date, time: b.start } : {}) }))
    if (b) setCat('Events & bookings')
  }
  const assigneeValue = `${f.assignee.type}:${f.assignee.id}`
  const staffRoles = Object.entries(ROLES).filter(([, r]) => r.group !== 'admin')

  const save = () => {
    const { date, time, bookingId, ...rest } = f
    const category = cat === 'Other' ? (otherCat.trim() || 'Other') : cat
    onSave({
      ...rest,
      title: f.title.trim(),
      category,
      due: new Date(`${date}T${time}`).toISOString(),
      kind: bookingId ? 'booking' : rest.kind === 'booking' || rest.kind === 'event' ? 'one-off' : rest.kind,
      source: bookingId ? { ...rest.source, bookingId } : rest.source?.issueId ? { issueId: rest.source.issueId } : undefined,
    })
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.title.trim() || (cat === 'Other' && !otherCat.trim())} onClick={save}>Assign task</button>
        </>
      }
    >
      {showTemplates && (
        <div className="field">
          <span className="label">Start from a template</span>
          <div className="chips">
            {TEMPLATES.map((t) => (
              <button key={t.title} className="chip" onClick={() => { setF((x) => ({ ...x, ...t })); setCat(categoryOf(t, s.users)) }}>{t.title}</button>
            ))}
          </div>
        </div>
      )}
      <label className="field">
        <span className="label">Task</span>
        <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Clean the kitchen floor" autoFocus />
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="label">Category</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {cat === 'Other' && (
          <label className="field">
            <span className="label">Name the category</span>
            <input value={otherCat} onChange={(e) => setOtherCat(e.target.value)} placeholder="e.g. Garden, Library, Fundraising" />
          </label>
        )}
          <label className="field">
            <span className="label">For a booking <span className="muted">(optional)</span></span>
            <select value={f.bookingId} onChange={(e) => linkBooking(e.target.value)}>
              <option value="">Not linked to a booking</option>
              {bookings.map((b) => <option key={b.id} value={b.id}>{b.title} · {b.space} · {new Date(`${b.date}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })} {b.start}</option>)}
            </select>
          </label>
        <label className="field">
          <span className="label">Assign to</span>
          <select
            value={assigneeValue}
            onChange={(e) => {
              const [type, id] = e.target.value.split(':')
              set('assignee', { type, id })
            }}
          >
            <optgroup label="A role (anyone on duty sees it)">
              {staffRoles.map(([id, r]) => <option key={id} value={`role:${id}`}>{r.label}</option>)}
            </optgroup>
            <optgroup label="A specific person">
              {s.users.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name} ({ROLES[u.role].label})</option>)}
            </optgroup>
          </select>
        </label>
        <label className="field">
          <span className="label">Where</span>
          <select value={f.area} onChange={(e) => set('area', e.target.value)}>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Date</span>
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Time</span>
          <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Repeats</span>
          <select value={f.bookingId ? 'one-off' : f.kind === 'booking' || f.kind === 'event' ? 'one-off' : f.kind} disabled={!!f.bookingId} onChange={(e) => set('kind', e.target.value)}>
            <option value="one-off">{f.bookingId ? 'Once, for this booking' : 'One time only'}</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Priority</span>
          <select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={f.critical} onChange={(e) => set('critical', e.target.checked)} />
        <span>
          <b>Needs a second person to sign off</b>
          <span className="muted small"> For safety tasks like locking up or gas off. The task only closes after a volunteer or committee member checks it.</span>
        </span>
      </label>
      <label className="field">
        <span className="label">Notes <span className="muted">(optional)</span></span>
        <textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </Modal>
  )
}
