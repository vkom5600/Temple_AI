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
import type { Issue, Task } from '../../types'

// H1 Home (design: screens/01_H1_home.png): what needs attention and today at the mandir.
// Phase 3 adds the Bookings card, Plan with AI and Broadcast; Phase 4 the festival reminders.
const SHOW_MAX = 4

export default function AdminHome() {
  const { user } = useAuth()
  const toast = useToast()
  const { summary, refreshSummary, openBroadcast, openAskAi } = useAdminContext()
  const isChairman = user?.role === 'chairman'
  const { inbox, error, reload } = useInbox(isChairman)
  const [today, setToday] = useState<Task[] | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [converting, setConverting] = useState<Issue | null>(null)

  const [upcoming, setUpcoming] = useState<Task[]>([])
  const loadToday = useCallback(() => {
    tasksApi.list({ view: 'today' }).then((r) => setToday(r.tasks)).catch(() => setToday([]))
    tasksApi.list({ view: 'open' }).then((r) => setUpcoming(r.tasks)).catch(() => {})
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
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
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
          {comingUp && (
            <Link to="/admin/tasks?tab=upcoming" className="coming-up">Coming up: {comingUp.title} · {fmtDay(comingUp.due_at)} <Icon name="arrow-right" size={15} /></Link>
          )}
        </div>
        <div className="head-actions">
          <button className="btn btn-primary btn-lg" onClick={openAskAi}><span className="star">✦</span> Plan with AI</button>
          <button className="btn btn-outline btn-lg" onClick={openBroadcast}><Icon name="send" size={17} /> Broadcast</button>
        </div>
      </header>

      <ErrorNote>{error}</ErrorNote>

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

        <section className="kpi">
          <div className="kpi-label">Action Center <Icon name="bell" size={20} /></div>
          <div className="kpi-value">{waiting} waiting</div>
          <div className="kpi-note">
            {summary ? `${summary.open_issues} problem${summary.open_issues === 1 ? '' : 's'} · ${summary.overdue} overdue · ${summary.awaiting_signoff} to sign off` : ' '}
          </div>
          {isChairman && (summary?.pending_registrations ?? 0) > 0 && (
            <div className="ai-banner" style={{ margin: 0 }}><Icon name="users" size={18} /> {summary!.pending_registrations} sign-up{summary!.pending_registrations > 1 ? 's' : ''} waiting for approval</div>
          )}
          <div className="kpi-foot"><Link to="/admin/action-center" className="btn btn-primary">Review <Icon name="arrow-right" size={16} /></Link></div>
        </section>
      </div>

      <div className="home-grid">
        <section className="panel">
          <div className="panel-head"><h2>Needs your attention</h2></div>
          {tip && <div className="ai-banner"><span className="star">✦</span> {tip}</div>}
          {!inbox && !error && <Spinner />}
          {inbox && !items.length && <p className="muted">All clear. Nothing is waiting for you.</p>}
          <div>
            {items.slice(0, SHOW_MAX).map((item) => (
              <InboxRow key={item.key} item={item} myId={user.id} onOpenTask={setViewing} onConvert={setConverting} act={act} />
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
          <TodaySchedule tasks={today} onOpen={setViewing} />
          <CheckInCard optIn />
        </div>
      </div>

      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {converting && <ConvertIssueForm issue={converting} onClose={() => setConverting(null)} onDone={(m) => { toast(m); setConverting(null); changed() }} />}
    </div>
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
function TodaySchedule({ tasks, onOpen }: { tasks: Task[] | null; onOpen: (id: number) => void }) {
  const list = [...(tasks ?? [])].filter((t) => t.status !== 'cancelled').sort(byDue)
  const now = Date.now()
  const nowIndex = list.findIndex((t) => dueMs(t) > now)
  const nextId = list.find((t) => t.due_at && dueMs(t) > now && t.status === 'todo')?.id
  const countdown = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - now) / 60000)
    return mins < 60 ? `in ${mins} min` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`
  }
  const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

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
      <p className="muted" style={{ margin: '0 0 14px' }}>Timings and tasks for today</p>
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
