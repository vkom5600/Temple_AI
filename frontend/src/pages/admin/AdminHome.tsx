import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { tasksApi } from '../../api/endpoints'
import { fmtDay, longDate } from '../../lib/format'
import { topTip, useInbox } from '../../lib/inbox'
import { assigneeLabel, byDue, dueMs, hhmm, isFinished } from '../../lib/tasks'
import { actionCount, useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import CheckInCard from '../../components/attendance/CheckInCard'
import InboxRow from '../../components/InboxRow'
import ConvertIssueForm from '../../components/tasks/ConvertIssueForm'
import TaskDetails from '../../components/tasks/TaskDetails'
import BookingReview from '../../components/bookings/BookingReview'
import { bookingsApi, festivalsApi } from '../../api/endpoints'
import { bookingDay, bookingTimes } from '../../lib/bookings'
import type { Booking, FestivalHome, ScheduleItem } from '../../types'
import type { Issue, Task } from '../../types'
import { useAccess } from '../../lib/access'
import { ukAddDays, ukEndOfDay, ukNoon, ukSameDay, ukStartOfDay, ukTime, ukDay } from '../../lib/uk'

// H1 Home (design: screens/01_H1_home.png): what needs attention and today at the mandir.
// Phase 3 adds the Bookings card, Plan with AI and Broadcast; Phase 4 the festival reminders.
const SHOW_MAX = 4

export default function AdminHome() {
  const { user } = useAuth()
  const toast = useToast()
  const { summary, refreshSummary, openBroadcast, openPlan } = useAdminContext()
  const isChairman = user?.role === 'chairman'
  const { inbox, error, reload } = useInbox(isChairman)
  const [today, setToday] = useState<Task[] | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [converting, setConverting] = useState<Issue | null>(null)

  const [upcoming, setUpcoming] = useState<Task[]>([])
  const [viewingBooking, setViewingBooking] = useState<number | null>(null)
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [fest, setFest] = useState<FestivalHome | null>(null)
  const access = useAccess()
  const loadToday = useCallback(() => {
    tasksApi.list({ view: 'today' }).then((r) => setToday(r.tasks)).catch(() => setToday([]))
    tasksApi.list({ view: 'open' }).then((r) => setUpcoming(r.tasks)).catch(() => {})
    const from = ukStartOfDay()
    const to = ukAddDays(from, 60)
    bookingsApi.list({ from: from.toISOString(), to: to.toISOString() }).then((r) => setBookings(r.bookings)).catch(() => setBookings([]))
    bookingsApi.schedule().then((r) => setSchedule(r.bookings)).catch(() => {})
    festivalsApi.home().then(setFest).catch(() => {})
  }, [])
  useEffect(loadToday, [loadToday])

  const changed = () => { reload(); loadToday(); refreshSummary() }
  const act = async (action: () => Promise<{ message: string }>) => {
    try {
      toast((await action()).message)
      changed()
    } catch (err) {
      toast((err as Error).message)
    }
  }

  if (!user) return null
  const day = inbox?.day
  const here = day?.counts.here ?? 0
  const items = inbox?.items ?? []
  const tip = topTip(items)
  const waiting = actionCount(summary, isChairman)
  const nextTask = today?.filter((t) => t.status === 'todo' && t.due_at && dueMs(t) > Date.now()).sort(byDue)[0]
  const endOfToday = ukEndOfDay()
  const comingUp = upcoming.filter((t) => t.due_at && dueMs(t) > endOfToday.getTime()).sort(byDue)[0]

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <h1>Namaste, {user.full_name.split(' ')[0]}</h1>
          <div className="home-sub">
            <span>{longDate()}</span>
            {day && (
              <span className={`pill ${here ? 'pill-soft' : 'pill-soft'}`}>
                <span className="dot" style={{ color: here ? 'var(--green-mid)' : '#b0adb8' }} /> {here ? `Mandir open · ${here} on site` : 'Nobody checked in yet'}
                {nextTask && ` · next task ${hhmm(nextTask.due_at)}`}
              </span>
            )}
          </div>
          {/* H1: the next festival (or, if none is listed, the next task) */}
          {!fest?.today.length && (fest?.next ? (
            <Link to="/admin/calendar" className="coming-up">Coming up: {fest.next.name} · {festDay(fest.next.date)} <Icon name="arrow-right" size={15} /></Link>
          ) : comingUp && (
            <Link to="/admin/tasks?tab=upcoming" className="coming-up">Coming up: {comingUp.title} · {fmtDay(comingUp.due_at)} <Icon name="arrow-right" size={15} /></Link>
          ))}
        </div>
        <div className="head-actions">
          {access.allowed('ai') && access.can('calendar', 'manage') && <button className="btn btn-primary btn-lg" onClick={() => openPlan()}><span className="star">✦</span> Plan with AI</button>}
          {access.allowed('broadcast') && <button className="btn btn-outline btn-lg" onClick={openBroadcast}><Icon name="send" size={17} /> Broadcast</button>}
        </div>
      </header>

      <ErrorNote>{error}</ErrorNote>

      {/* H2: festival day banner (designs 04 Ekadashi, 05 Diwali) */}
      {fest?.today.map((f) => (
        <div key={f.id} className="fest-banner">
          <Icon name="diya" size={22} />
          <b>{f.name} today{f.subtitle ? ` · ${f.subtitle}` : ''}</b>
          <span className="fest-right">
            {f.kind === 'festival'
              ? [fest.events_today ? `${fest.events_today} festival event${fest.events_today === 1 ? '' : 's'}` : null, f.opens && f.closes ? `Extended hours ${f.opens}–${f.closes}` : null].filter(Boolean).join(' · ')
              : fest.next ? <Link to="/admin/calendar">Coming up: {fest.next.name} · {festDay(fest.next.date)} →</Link> : null}
          </span>
        </div>
      ))}

      {/* H1 with a festival reminder (design 02): "Diwali is in 6 weeks..." */}
      {fest?.reminder && (
        <div className="fest-remind">
          <span className="star">✦</span>
          <span className="grow">
            {fest.reminder.festival.name} is in {fest.reminder.days >= 14 ? `${Math.round(fest.reminder.days / 7)} weeks` : `${fest.reminder.days} day${fest.reminder.days === 1 ? '' : 's'}`}.
            {fest.reminder.last_time ? ` Last time you ran ${fest.reminder.last_time.tasks} tasks${fest.reminder.last_time.volunteers ? ` and ${fest.reminder.last_time.volunteers} volunteers` : ''}.` : ' Nothing is planned yet.'}
          </span>
          {access.allowed('ai') && access.can('calendar', 'manage') && <button className="btn btn-primary btn-sm" onClick={() => openPlan(`${fest.reminder!.festival.name} celebration, ${festDay(fest.reminder!.festival.date, true)}`)}>Plan it</button>}
          <button className="link-btn" onClick={() => festivalsApi.snooze(fest.reminder!.festival.id, 'week').then((r) => { toast(r.message); setFest({ ...fest, reminder: null }) }).catch(() => {})}>Later</button>
          <button className="link-btn muted" onClick={() => festivalsApi.snooze(fest.reminder!.festival.id, 'year').then((r) => { toast(r.message); setFest({ ...fest, reminder: null }) }).catch(() => {})}>Not this year</button>
        </div>
      )}

      <div className="kpis">
        <TasksCard today={today} overdue={summary?.overdue ?? 0} />

        <section className="kpi">
          <div className="kpi-label green">Attendance <Icon name="badge" size={20} /></div>
          {day ? (
            <>
              <div className="kpi-value">{here} of {day.people.length - day.counts.absent} on site</div>
              <div className="bar green"><i style={{ width: `${day.people.length ? (here / Math.max(1, day.people.length - day.counts.absent)) * 100 : 0}%` }} /></div>
              {day.counts.not_in > 0 ? (
                <div className="kpi-note">Not checked in: <b>{day.people.filter((p) => p.state === 'not_in').map((p) => p.full_name.split(' ')[0]).join(', ')}</b></div>
              ) : (
                <div className="kpi-note">Everyone expected has checked in.</div>
              )}
            </>
          ) : <Spinner />}
          <div className="kpi-foot"><Link to="/admin/people" className="link-arrow">See everyone <Icon name="arrow-right" size={16} /></Link></div>
        </section>

        <BookingsCard bookings={bookings} waiting={waiting} onOpen={setViewingBooking} />
      </div>

      <div className="home-grid">
        <section className="panel">
          <div className="panel-head"><h2>Needs your attention</h2></div>
          {tip && <div className="ai-banner"><span className="star">✦</span> {tip}</div>}
          {!inbox && !error && <Spinner />}
          {inbox && !items.length && <p className="muted">All clear. Nothing is waiting for you.</p>}
          <div>
            {items.slice(0, SHOW_MAX).map((item) => (
              <InboxRow key={item.key} item={item} myId={user.id} onOpenTask={setViewing} onOpenBooking={setViewingBooking} onConvert={setConverting} act={act} />
            ))}
          </div>
          {items.length > 0 && (
            <div className="panel-foot">
              <Link to="/admin/action-center" className="link-arrow link-saf">See all {items.length} in Action Center <Icon name="arrow-right" size={16} /></Link>
              {items.length > SHOW_MAX && <span className="muted small">{items.length - SHOW_MAX} more</span>}
            </div>
          )}
          {inbox && inbox.handledToday.length > 0 && (
            <p className="muted small" style={{ marginTop: 14 }}><Icon name="check-circle" size={14} /> {inbox.handledToday.length} problem{inbox.handledToday.length > 1 ? 's' : ''} sorted today</p>
          )}
        </section>

        <div className="side-col">
          <TodaySchedule tasks={today} bookings={schedule} onOpen={setViewing} onOpenBooking={setViewingBooking} />
          <CheckInCard optIn />
        </div>
      </div>

      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {viewingBooking && <BookingReview bookingId={viewingBooking} onClose={() => setViewingBooking(null)} onChanged={changed} />}
      {converting && <ConvertIssueForm issue={converting} onClose={() => setConverting(null)} onDone={(m) => { toast(m); setConverting(null); changed() }} />}
    </div>
  )
}

// H1 "Bookings" card: today's bookings, the next one, and requests waiting.
function BookingsCard({ bookings, waiting, onOpen }: { bookings: Booking[] | null; waiting: number; onOpen: (id: number) => void }) {
  const confirmed = (bookings ?? []).filter((b) => b.status === 'approved')
  const today = confirmed.filter((b) => ukSameDay(new Date(b.starts_at), new Date()))
  const next = confirmed.find((b) => new Date(b.starts_at) > new Date())
  const pending = (bookings ?? []).filter((b) => b.status === 'pending')
  return (
    <section className="kpi">
      <div className="kpi-label">Bookings <Icon name="calendar" size={20} /></div>
      {bookings ? (
        <>
          <div className="kpi-value">{today.length} today</div>
          <div className="kpi-note">{next ? <>Next: <b>{bookingDay(next.starts_at)} · {next.title} {bookingTimes(next).split(' – ')[0]}</b></> : 'Nothing booked coming up'}</div>
          {pending.length > 0 && (
            <button className="kpi-box" onClick={() => onOpen(pending[0].id)}>
              <Icon name="calendar" size={18} /> {pending.length} request{pending.length > 1 ? 's' : ''} waiting for approval
            </button>
          )}
        </>
      ) : <Spinner />}
      <div className="kpi-foot">
        {waiting > 0 && <span className="muted small push-left">{waiting} in the Action Center</span>}
        <Link to="/admin/action-center" className="btn btn-primary">Review <Icon name="arrow-right" size={16} /></Link>
      </div>
    </section>
  )
}

function TasksCard({ today, overdue }: { today: Task[] | null; overdue: number }) {
  const done = today?.filter(isFinished).length ?? 0
  const total = today?.length ?? 0
  const awaiting = today?.filter((t) => t.status === 'awaiting_signoff').length ?? 0
  const flagged = today?.filter((t) => t.status === 'flagged').length ?? 0
  return (
    <section className="kpi">
      <div className="kpi-label">Today's tasks <Icon name="list" size={20} /></div>
      {today ? (
        <>
          <div className="kpi-value">{done} of {total} done</div>
          <div className="bar"><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
          <div className="row" style={{ gap: 8 }}>
            {awaiting > 0 && <span className="pill pill-saf"><span className="dot" /> {awaiting} awaiting review</span>}
            {overdue > 0 && <span className="pill pill-red"><span className="dot" /> {overdue} overdue</span>}
            {flagged > 0 && <span className="pill pill-soft">{flagged} couldn't be done</span>}
            {!awaiting && !overdue && !flagged && <span className="pill pill-grn">On track</span>}
          </div>
        </>
      ) : <Spinner />}
      <div className="kpi-foot"><Link to="/admin/tasks" className="link-arrow">View all tasks <Icon name="arrow-right" size={16} /></Link></div>
    </section>
  )
}

// "Today at the mandir": today's timings as a timeline, with a line for now.
// Bookings and puja times join this list when the calendar is built (Phase 3).
function TodaySchedule({ tasks, bookings, onOpen, onOpenBooking }: { tasks: Task[] | null; bookings: ScheduleItem[]; onOpen: (id: number) => void; onOpenBooking: (id: number) => void }) {
  const list = [...(tasks ?? [])].filter((t) => t.status !== 'cancelled').sort(byDue)
  const now = Date.now()
  const nowIndex = list.findIndex((t) => dueMs(t) > now)
  const nextId = list.find((t) => t.due_at && dueMs(t) > now && t.status === 'todo')?.id
  const countdown = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - now) / 60000)
    return mins < 60 ? `in ${mins} min` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`
  }
  const nowLabel = ukTime(new Date())

  const row = (t: Task) => {
    const past = dueMs(t) <= now
    const state = isFinished(t) ? 'done' : t.is_overdue ? 'late' : t.requires_verification ? 'safety' : ''
    return (
      <li key={t.id} className={`${past ? 'past' : ''} ${t.id === nextId ? 'next-up' : ''}`}>
        <span className={`sched-dot ${state}`}>{state === 'done' && <Icon name="check" size={12} />}{t.id === nextId && <Icon name="bell" size={12} />}</span>
        <span className={`sched-time ${t.due_at ? '' : 'any'}`}>{t.due_at ? hhmm(t.due_at) : 'Any time'}</span>
        <button className="sched-what" onClick={() => onOpen(t.id)}>
          {t.id === nextId && <span className="tag-mini">Next</span>}
          {t.title}
          <small>{assigneeLabel(t)}{state === 'late' ? ' · late' : ''}</small>
          {t.id === nextId && <span className="countdown">{countdown(t.due_at!)}</span>}
        </button>
        {t.area && <span className="sched-where">{t.area}</span>}
      </li>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head" style={{ marginBottom: 4 }}><h2>Today at the mandir</h2></div>
      <p className="muted" style={{ margin: '0 0 14px' }}>Timings, activities and bookings</p>
      {bookings.length > 0 && (
        <div className="sched-bookings">
          <span className="ulabel">Bookings today</span>
          {bookings.map((bk) => {
            const live = new Date(bk.starts_at).getTime() <= now && new Date(bk.ends_at).getTime() > now
            return (
              <button key={bk.id} className={`sched-booking ${live ? 'is-live' : ''}`} onClick={() => onOpenBooking(bk.id)}>
                <span className="sb-time">{live && <i className="live-dot" />}{bookingTimes(bk)}</span>
                <span className="sb-main">
                  <b>{bk.title}</b>
                  <small>{bk.resource_name}{live && <em> · happening now</em>}</small>
                </span>
                <span className={`tag ${bk.kind === 'event' ? 'tag-grn' : 'tag-ind'}`}>{bk.kind === 'event' ? 'Event' : 'Booking'}</span>
              </button>
            )
          })}
          <span className="ulabel" style={{ marginTop: 10 }}>Schedule</span>
        </div>
      )}
      {!tasks && <Spinner />}
      {tasks && !list.length && <p className="muted">Nothing scheduled today.</p>}
      {list.length > 0 && (
        <ul className="schedule">
          {list.map((t, i) => (
            <Fragment key={t.id}>
              {i === nowIndex && <li className="now-line"><span /> {nowLabel}</li>}
              {row(t)}
            </Fragment>
          ))}
          {nowIndex === -1 && <li key="now" className="now-line"><span /> {nowLabel}</li>}
        </ul>
      )}
      <div className="row muted small" style={{ marginTop: 14, gap: 16 }}>
        <span className="row" style={{ gap: 6 }}><span className="sched-dot done" style={{ width: 12, height: 12 }} /> Done</span>
        <span className="row" style={{ gap: 6 }}><span className="sched-dot late" style={{ width: 12, height: 12 }} /> Late</span>
        <span className="row" style={{ gap: 6 }}><span className="sched-dot safety" style={{ width: 12, height: 12 }} /> Safety</span>
      </div>
    </section>
  )
}

// "Sun 16 Nov" (with the year for Plan with AI, so it never guesses)
const festDay = (date: string, withYear = false) =>
  ukDay(ukNoon(date), { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
