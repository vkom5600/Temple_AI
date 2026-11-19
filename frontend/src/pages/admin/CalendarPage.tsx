import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { bookingsApi, resourcesApi, tasksApi, festivalsApi } from '../../api/endpoints'
import { bookingTimes } from '../../lib/bookings'
import { toDateInput } from '../../lib/format'
import { assigneeLabel, byDue, hhmm, isFinished } from '../../lib/tasks'
import { Icon, Modal, Spinner } from '../../components/ui'
import BookingForm, { type BookingDraft } from '../../components/bookings/BookingForm'
import BookingReview from '../../components/bookings/BookingReview'
import ResourcesDialog from '../../components/bookings/ResourcesDialog'
import FestivalsDialog from '../../components/FestivalsDialog'
import type { Festival } from '../../types'
import TaskDetails from '../../components/tasks/TaskDetails'
import { useAdminContext } from '../../layouts/AdminLayout'
import type { Booking, Resource, Task } from '../../types'
import { useAccess } from '../../lib/access'
import ViewOnly from '../../components/ViewOnly'

// C1 Calendar month, C3 Day opened (designs: screens/23_C1, 24_C3), and the
// Allocation view the committee asked for (19 Nov): every hall and room down the
// side, the day across, so the office can see and allocate space at a glance.
// Google Calendar two-way sync switches on once the temple's Google keys are added.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
type Filter = 'all' | 'bookings' | 'events' | 'waiting' | 'tasks'
type View = 'month' | 'allocation'

export default function CalendarPage() {
  const { refreshSummary } = useAdminContext()
  const manage = useAccess().can('calendar', 'manage')
  const [view, setView] = useState<View>('month')
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [day, setDay] = useState(() => new Date())
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [openDay, setOpenDay] = useState<Date | null>(null)
  const [viewingTask, setViewingTask] = useState<number | null>(null)
  const [viewingBooking, setViewingBooking] = useState<number | null>(null)
  const [adding, setAdding] = useState<BookingDraft | null>(null)
  const [festivals, setFestivals] = useState<Festival[]>([])
  const [managingFestivals, setManagingFestivals] = useState(false)

  // Load a little either side of what's on screen.
  const load = useCallback(() => {
    const from = new Date(view === 'month' ? month : day); from.setDate(from.getDate() - 7)
    const to = new Date(view === 'month' ? month : day); to.setMonth(to.getMonth() + 1); to.setDate(to.getDate() + 7)
    bookingsApi.list({ from: from.toISOString(), to: to.toISOString() })
      .then((r) => setBookings(r.bookings.filter((b) => b.status === 'approved' || b.status === 'pending')))
      .catch(() => setBookings([]))
    tasksApi.list({ view: 'all' }).then((r) => setTasks(r.tasks)).catch(() => setTasks([]))
    festivalsApi.list(toDateInput(from), toDateInput(to)).then((r) => setFestivals(r.festivals)).catch(() => {})
  }, [view, month, day])
  useEffect(load, [load])
  const changed = () => { load(); refreshSummary() }

  const showBooking = (b: Booking) =>
    filter === 'all' || (filter === 'bookings' && b.kind === 'booking' && b.status === 'approved') ||
    (filter === 'events' && b.kind === 'event') || (filter === 'waiting' && b.status === 'pending')
  const shownTasks = filter === 'tasks' || filter === 'all' ? tasks.filter((t) => t.due_at && !t.booking_id) : []

  const byDay = new Map<string, { b: Booking[]; t: Task[] }>()
  const slot = (k: string) => byDay.get(k) ?? byDay.set(k, { b: [], t: [] }).get(k)!
  for (const b of (bookings ?? []).filter(showBooking)) slot(dayKey(new Date(b.starts_at))).b.push(b)
  for (const t of [...shownTasks].sort(byDue)) slot(dayKey(new Date(t.due_at!))).t.push(t)

  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7))
  const weeks = Math.ceil((((month.getDay() + 6) % 7) + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const today = dayKey(new Date())
  const shiftMonth = (n: number) => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + n); return d })
  const shiftDay = (n: number) => setDay((x) => { const d = new Date(x); d.setDate(d.getDate() + n); return d })
  const open = openDay ? byDay.get(dayKey(openDay)) ?? { b: [], t: [] } : null
  const waiting = (bookings ?? []).filter((b) => b.status === 'pending').length

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Calendar {!manage && <ViewOnly />}</h1>
          <p>Festivals, temple events and hall bookings</p>
        </div>
        <div className="head-actions">
          <span className="gcal-chip" title="Two-way sync with the temple's Google Calendar switches on when its keys are added">
            <Icon name="calendar" size={18} />
            <span><b>Google Calendar <i className="dot-off" /></b><small>Not connected yet · 2-way when keys are added</small></span>
          </span>
          {manage && <button className="btn btn-outline btn-lg" onClick={() => setManagingFestivals(true)}><Icon name="diya" size={18} /> Festivals</button>}
          {manage && <button className="btn btn-primary btn-lg" onClick={() => setAdding({})}><Icon name="plus" size={18} /> Add to calendar</button>}
        </div>
      </header>

      <div className="cal-bar">
        {view === 'month' ? (
          <div className="month-nav">
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><Icon name="chevron-right" size={18} /></button>
            <b>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</b>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><Icon name="chevron-right" size={18} /></button>
          </div>
        ) : (
          <div className="month-nav">
            <button className="icon-btn" onClick={() => shiftDay(-1)} aria-label="Previous day"><Icon name="chevron-right" size={18} /></button>
            <b>{day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })}</b>
            <button className="icon-btn" onClick={() => shiftDay(1)} aria-label="Next day"><Icon name="chevron-right" size={18} /></button>
          </div>
        )}
        <button className="btn btn-outline" onClick={() => { const d = new Date(); setDay(d); const m = new Date(); m.setDate(1); setMonth(m) }}>Today</button>
        <div className="cal-filters">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'bookings' ? 'on' : ''} onClick={() => setFilter('bookings')}><i className="lg lg-ind" /> Bookings</button>
          <button className={filter === 'events' ? 'on' : ''} onClick={() => setFilter('events')}><i className="lg lg-grn" /> Temple events</button>
          <button className={filter === 'waiting' ? 'on' : ''} onClick={() => setFilter('waiting')}><i className="lg lg-saf" /> Waiting{waiting ? ` (${waiting})` : ''}</button>
          {view === 'month' && <button className={filter === 'tasks' ? 'on' : ''} onClick={() => setFilter('tasks')}><i className="lg" style={{ background: '#b0adb8' }} /> Tasks</button>}
        </div>
        <div className="segmented" style={{ marginLeft: 'auto' }}>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
          <button className={view === 'allocation' ? 'on' : ''} onClick={() => setView('allocation')}>Allocation</button>
        </div>
      </div>

      {!bookings && <Spinner />}

      {view === 'month' ? (
        <div className="mcal" role="grid" aria-label={month.toLocaleDateString([], { month: 'long', year: 'numeric' })}>
          {WEEKDAYS.map((w) => <div key={w} className="mcal-wd" role="columnheader">{w}</div>)}
          {days.map((d) => {
            const items = byDay.get(dayKey(d)) ?? { b: [], t: [] }
            const all = [...items.b.map((b) => ({ key: `b${b.id}`, at: b.starts_at, label: `${hhmm(b.starts_at)} ${b.title}`, cls: b.status === 'pending' ? 'wait' : b.kind === 'event' ? 'evt' : '' })),
              ...items.t.map((t) => ({ key: `t${t.id}`, at: t.due_at!, label: `${hhmm(t.due_at)} ${t.title}`, cls: `task ${isFinished(t) ? 'done' : ''}` }))]
              .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
            const isToday = dayKey(d) === today
            return (
              <button
                key={d.toISOString()}
                className={`mcal-day ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => setOpenDay(d)}
                aria-label={`${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}, ${all.length} items`}
              >
                <span className="mcal-top">
                  <span className="mcal-num">{d.getDate()}</span>
                  {isToday && <span className="mcal-today">Today</span>}
                </span>
                {festivals.filter((f) => f.date === toDateInput(d)).map((f) => <span key={`f${f.id}`} className={`mcal-fest ${f.confirmed ? '' : 'tbc'}`} title={f.confirmed ? f.name : `${f.name} (date to confirm)`}>{f.name}</span>)}
                {all.slice(0, 3).map((x) => <span key={x.key} className={`mcal-item ${x.cls}`}>{x.label}</span>)}
                {all.length > 3 && <span className="mcal-more">+{all.length - 3} more</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <Allocation day={day} bookings={(bookings ?? []).filter(showBooking)} onOpen={setViewingBooking} onAdd={manage ? setAdding : () => {}} onChanged={changed} />
      )}

      {openDay && open && (
        <Modal
          title={openDay.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })}
          onClose={() => setOpenDay(null)}
          head={
            <div className="grow">
              <h2 className="row" style={{ gap: 12 }}>
                {openDay.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })}
                {dayKey(openDay) === today && <span className="saf-chip">Today</span>}
              </h2>
              <p className="modal-sub">{open.b.length || open.t.length ? `${open.b.length} booking${open.b.length === 1 ? '' : 's'} · ${open.t.length} task${open.t.length === 1 ? '' : 's'}` : 'Nothing on this day yet'}</p>
            </div>
          }
          footer={
            <>
              <button className="link-arrow push-left" onClick={() => { setAdding({ date: toDateInput(openDay) }); setOpenDay(null) }}><Icon name="plus" size={16} /> Add on {openDay.toLocaleDateString([], { day: 'numeric', month: 'long' })}</button>
              <button className="btn btn-outline" onClick={() => { setDay(openDay); setView('allocation'); setOpenDay(null) }}><Icon name="grid" size={16} /> See allocation</button>
            </>
          }
        >
          {open.b.map((b) => (
            <button key={b.id} className={`day-entry ${b.status === 'pending' ? 'saf' : b.kind === 'event' ? 'evt' : ''}`} onClick={() => { setViewingBooking(b.id); setOpenDay(null) }}>
              <span className="day-line"><b>{bookingTimes(b)}</b> <span>{b.title}</span></span>
              <span className="day-sub">
                <span>{[b.resource_name, b.contact_name ?? b.requested_by_name].filter(Boolean).join(' · ')}</span>
                <span className={b.status === 'pending' ? 'st-late' : 'st-here'}><i className="dot" /> {b.status === 'pending' ? 'Waiting for approval' : b.kind === 'event' ? 'Temple event' : 'Confirmed'}</span>
              </span>
            </button>
          ))}
          {open.t.map((t) => (
            <button key={t.id} className={`day-entry task ${t.requires_verification ? 'saf' : ''}`} onClick={() => { setViewingTask(t.id); setOpenDay(null) }}>
              <span className="day-line"><b>{hhmm(t.due_at)}</b> <span>{t.title}</span></span>
              <span className="day-sub">
                <span>{[t.area, assigneeLabel(t)].filter(Boolean).join(' · ')}</span>
                <span className={isFinished(t) ? 'st-here' : t.is_overdue ? 'st-absent' : 'st-off'}><i className="dot" /> Task · {isFinished(t) ? 'done' : t.is_overdue ? 'overdue' : 'to do'}</span>
              </span>
            </button>
          ))}
        </Modal>
      )}

      {managingFestivals && <FestivalsDialog onClose={() => setManagingFestivals(false)} onChanged={load} />}
      {adding && <BookingForm draft={adding} onClose={() => setAdding(null)} onSaved={changed} />}
      {viewingBooking && <BookingReview bookingId={viewingBooking} onClose={() => setViewingBooking(null)} onChanged={changed} />}
      {viewingTask && <TaskDetails taskId={viewingTask} onClose={() => setViewingTask(null)} onChanged={changed} />}
    </div>
  )
}

// ---------------------------------------------------------------- Allocation ("one view")

const FIRST_HOUR = 7
const LAST_HOUR = 23
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i)
const pct = (date: Date, ref: Date) => {
  const startOfGrid = new Date(ref); startOfGrid.setHours(FIRST_HOUR, 0, 0, 0)
  const mins = (date.getTime() - startOfGrid.getTime()) / 60000
  return Math.min(100, Math.max(0, (mins / ((LAST_HOUR - FIRST_HOUR) * 60)) * 100))
}

function Allocation({ day, bookings, onOpen, onAdd, onChanged }: {
  day: Date
  bookings: Booking[]
  onOpen: (id: number) => void
  onAdd: (draft: BookingDraft) => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [resources, setResources] = useState<Resource[] | null>(null)
  const [managing, setManaging] = useState(false)
  const loadResources = () => { resourcesApi.list().then((r) => setResources(r.resources)).catch(() => setResources([])) }
  useEffect(loadResources, [])

  const sameDay = (iso: string) => new Date(iso).toDateString() === day.toDateString()
  const todays = bookings.filter((b) => sameDay(b.starts_at) || sameDay(b.ends_at))
  const now = new Date()
  const showNow = now.toDateString() === day.toDateString() && now.getHours() >= FIRST_HOUR && now.getHours() < LAST_HOUR
  const busy = new Set(todays.map((b) => b.resource_id))

  // Click an empty part of a row: book that space from the nearest hour, for two hours.
  const addAt = (resource: Resource, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.alloc-block')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const hour = Math.min(LAST_HOUR - 1, FIRST_HOUR + Math.floor(((e.clientX - rect.left) / rect.width) * (LAST_HOUR - FIRST_HOUR)))
    const pad = (n: number) => String(n).padStart(2, '0')
    onAdd({ date: toDateInput(day), start: `${pad(hour)}:00`, end: `${pad(Math.min(23, hour + 2))}:00`, resource_id: resource.id })
  }

  return (
    <section className="alloc">
      <div className="alloc-summary">
        <span><b>{busy.size}</b> of {resources?.length ?? '…'} spaces in use on {day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        <span className="row muted small" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 6 }}><i className="alloc-key" /> Confirmed</span>
          <span className="row" style={{ gap: 6 }}><i className="alloc-key wait" /> Waiting</span>
          <span className="row" style={{ gap: 6 }}><i className="alloc-key evt" /> Temple event</span>
          <span>Tap an empty slot to book it</span>
        </span>
        {user?.role === 'chairman' && <button className="btn btn-outline btn-sm" onClick={() => setManaging(true)}><Icon name="settings" size={15} /> Halls &amp; rooms</button>}
      </div>
      {!resources && <Spinner />}
      {resources && (
        <div className="alloc-grid">
          <div className="alloc-head">
            <span className="alloc-name" />
            <div className="alloc-hours">{HOURS.map((h) => <span key={h}>{String(h).padStart(2, '0')}</span>)}</div>
          </div>
          {resources.map((r) => (
            <div key={r.id} className="alloc-row">
              <span className="alloc-name"><b>{r.name}</b><small>{r.capacity ? `up to ${r.capacity}` : r.kind}</small></span>
              <div className="alloc-track" onClick={(e) => addAt(r, e)} role="button" tabIndex={0} aria-label={`Book ${r.name}`}
                onKeyDown={(e) => e.key === 'Enter' && onAdd({ date: toDateInput(day), resource_id: r.id })}>
                {HOURS.map((h) => <i key={h} className="alloc-line" style={{ left: `${((h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%` }} />)}
                {showNow && <i className="alloc-now" style={{ left: `${pct(now, day)}%` }} />}
                {todays.filter((b) => b.resource_id === r.id).map((b) => {
                  const left = pct(new Date(b.starts_at), day)
                  const right = pct(new Date(b.ends_at), day)
                  if (right <= 0 || left >= 100) return null // entirely outside 07:00–23:00
                  const width = Math.max(2, right - left)
                  return (
                    <button key={b.id} className={`alloc-block ${b.status === 'pending' ? 'wait' : b.kind === 'event' ? 'evt' : ''}`}
                      style={{ left: `${left}%`, width: `${width}%` }} onClick={() => onOpen(b.id)} title={`${b.title} · ${bookingTimes(b)}`}>
                      <b>{b.title}</b><small>{bookingTimes(b)}{b.status === 'pending' ? ' · waiting' : ''}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {managing && <ResourcesDialog onClose={() => { setManaging(false); loadResources(); onChanged() }} />}
    </section>
  )
}
