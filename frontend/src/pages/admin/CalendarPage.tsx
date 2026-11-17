import { useEffect, useState } from 'react'
import { tasksApi } from '../../api/endpoints'
import { assigneeLabel, byDue, hhmm, isFinished } from '../../lib/tasks'
import { Icon, Modal, Spinner } from '../../components/ui'
import TaskDetails from '../../components/tasks/TaskDetails'
import TaskForm from '../../components/tasks/TaskForm'
import { useToast } from '../../components/Toast'
import { useAdminContext } from '../../layouts/AdminLayout'
import type { Task } from '../../types'

// C1 Calendar: Month and C3 Day opened (designs: screens/23_C1, 24_C3).
// Phase 3 connects Google Calendar both ways (festivals, temple events, bookings).
// Until then the entries are the temple's tasks; clicking a day opens that day.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
type Filter = 'all' | 'safety' | 'routine'

export default function CalendarPage() {
  const toast = useToast()
  const { refreshSummary } = useAdminContext()
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openDay, setOpenDay] = useState<Date | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [adding, setAdding] = useState<Date | null>(null)

  const load = () => { tasksApi.list({ view: 'all' }).then((r) => setTasks(r.tasks)).catch(() => setTasks([])) }
  useEffect(load, [])
  const changed = () => { load(); refreshSummary() }

  const start = new Date(month)
  start.setDate(1 - ((month.getDay() + 6) % 7)) // back to Monday
  const weeks = Math.ceil((((month.getDay() + 6) % 7) + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })

  // Tasks with no deadline have no day, so they aren't on the calendar.
  const shown = (tasks ?? []).filter((t) => t.due_at && (filter === 'all' || (filter === 'safety' ? t.requires_verification : t.recurrence !== 'none')))
  const byDay = new Map<string, Task[]>()
  for (const t of [...shown].sort(byDue)) {
    const k = dayKey(new Date(t.due_at!))
    byDay.set(k, [...(byDay.get(k) ?? []), t])
  }
  const today = dayKey(new Date())
  const shift = (n: number) => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + n); return d })
  const dayTasks = openDay ? byDay.get(dayKey(openDay)) ?? [] : []

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>Festivals, temple events and hall bookings</p>
        </div>
        <div className="head-actions">
          <span className="gcal-chip" title="Two-way Google Calendar sync is built in Phase 3">
            <Icon name="calendar" size={18} />
            <span><b>Google Calendar <i className="dot-off" /></b><small>Not connected yet · 2-way in Phase 3</small></span>
          </span>
          <button className="btn btn-primary btn-lg" onClick={() => setAdding(new Date())}><Icon name="plus" size={18} /> Add to calendar</button>
        </div>
      </header>

      <div className="cal-bar">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevron-right" size={18} /></button>
          <b>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</b>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron-right" size={18} /></button>
        </div>
        <button className="btn btn-outline" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d) }}>Today</button>
        <div className="cal-filters">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'routine' ? 'on' : ''} onClick={() => setFilter('routine')}><i className="lg lg-ind" /> Daily routine</button>
          <button className={filter === 'safety' ? 'on' : ''} onClick={() => setFilter('safety')}><i className="lg lg-saf" /> Safety checks</button>
          <button disabled title="Phase 3"><i className="lg lg-grn" /> Temple events</button>
          <button disabled title="Phase 3"><Icon name="calendar" size={14} /> Google Calendar</button>
        </div>
        <div className="segmented" style={{ marginLeft: 'auto' }}>
          <button className="on">Month</button>
          <button disabled title="C2 Week is still to design">Week</button>
        </div>
      </div>

      <div className="cal-connect"><Icon name="alert" size={16} /> <b>Google Calendar not connected yet.</b> Festivals, events and bookings will sync both ways in Phase 3. For now the calendar shows the temple's tasks.</div>

      {!tasks && <Spinner />}
      <div className="mcal" role="grid" aria-label={month.toLocaleDateString([], { month: 'long', year: 'numeric' })}>
        {WEEKDAYS.map((w) => <div key={w} className="mcal-wd" role="columnheader">{w}</div>)}
        {days.map((d) => {
          const list = byDay.get(dayKey(d)) ?? []
          const isToday = dayKey(d) === today
          return (
            <button
              key={d.toISOString()}
              className={`mcal-day ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setOpenDay(d)}
              aria-label={`${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}, ${list.length} items`}
            >
              <span className="mcal-top">
                <span className="mcal-num">{d.getDate()}</span>
                {isToday && <span className="mcal-today">Today</span>}
              </span>
              {list.slice(0, 3).map((t) => (
                <span key={t.id} className={`mcal-item ${t.requires_verification ? 'saf' : ''} ${isFinished(t) ? 'done' : ''}`}>{hhmm(t.due_at)} {t.title}</span>
              ))}
              {list.length > 3 && <span className="mcal-more">+{list.length - 3} more</span>}
            </button>
          )
        })}
      </div>

      {openDay && (
        <Modal
          title={openDay.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })}
          onClose={() => setOpenDay(null)}
          head={
            <div className="grow">
              <h2 className="row" style={{ gap: 12 }}>
                {openDay.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })}
                {dayKey(openDay) === today && <span className="saf-chip">Today</span>}
              </h2>
              <p className="modal-sub">{dayTasks.length ? `${dayTasks.length} item${dayTasks.length > 1 ? 's' : ''} · ${dayTasks.filter(isFinished).length} done` : 'Nothing on this day yet'}</p>
            </div>
          }
          footer={
            <>
              <button className="link-arrow push-left" onClick={() => { setAdding(openDay); setOpenDay(null) }}><Icon name="plus" size={16} /> Add on {openDay.toLocaleDateString([], { day: 'numeric', month: 'long' })}</button>
              <button className="btn btn-outline" disabled title="Phase 3"><Icon name="calendar" size={16} /> Open in Google Calendar</button>
            </>
          }
        >
          {dayTasks.map((t) => (
            <button key={t.id} className={`day-entry ${t.requires_verification ? 'saf' : ''}`} onClick={() => { setViewing(t.id); setOpenDay(null) }}>
              <span className="day-line"><b>{hhmm(t.due_at)}</b> <span>{t.title}</span></span>
              <span className="day-sub">
                <span>{[t.area, assigneeLabel(t)].filter(Boolean).join(' · ')}</span>
                <span className={isFinished(t) ? 'st-here' : t.is_overdue ? 'st-absent' : 'st-off'}><i className="dot" /> {t.status === 'awaiting_signoff' ? 'Awaiting review' : isFinished(t) ? 'Done' : t.is_overdue ? 'Overdue' : t.status === 'flagged' ? "Couldn't do" : 'To do'}</span>
              </span>
            </button>
          ))}
        </Modal>
      )}

      {adding && (
        <TaskForm
          showTemplates
          allowMany
          initial={{ due_at: (() => { const d = new Date(adding); d.setHours(10, 0, 0, 0); return d.toISOString() })() }}
          onClose={() => setAdding(null)}
          onSubmit={async (inputs) => {
            const r = await tasksApi.create(inputs)
            toast(r.message)
            setAdding(null)
            changed()
          }}
        />
      )}
      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
    </div>
  )
}
