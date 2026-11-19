import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, bookingsApi, notificationsApi, tasksApi } from '../../api/endpoints'
import { Link } from 'react-router-dom'
import { bookingTimes } from '../../lib/bookings'
import { useAuth } from '../../auth/AuthContext'
import { fmtDay, fmtInline, fmtTime, greeting, isToday, longDate, timeAgo } from '../../lib/format'
import { byDue, isFinished } from '../../lib/tasks'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner, rowClick } from '../../components/ui'
import { Mandala } from '../../components/Ornaments'
import { HistoryDialog, LeavingSheet } from '../../components/attendance/CheckInCard'
import ProblemSheet from '../../components/tasks/ProblemSheet'
import HelpSheet from '../../components/tasks/HelpSheet'
import VerifyList from '../../components/tasks/VerifyList'
import type { AppNotification, ClosingChecks, MyAttendance, ScheduleItem, Task } from '../../types'

// Staff phone app: M1 Arriving and M2 Your tasks today (designs: screens/33_M1, 34_M2).
// One scrolling page. Tasks unlock once you tap "I'm here"; "I'm leaving" checks you out.
type Result = { message: string }

export default function StaffHome() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [me, setMe] = useState<MyAttendance | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Task | 'general' | null>(null)
  const [help, setHelp] = useState<Task | null>(null)
  const [openTask, setOpenTask] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [history, setHistory] = useState(false)

  const loadTasks = useCallback(() => {
    tasksApi.list().then((r) => setTasks(r.tasks)).catch((e: Error) => setError(e.message))
  }, [])
  // H3 Broadcast: the newest unread message from the chairman/committee, at the top (M2 "Message from Raghu")
  const [message, setMessage] = useState<AppNotification | null>(null)
  // Confirmed bookings and temple events today ("Today at the temple", M2)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  useEffect(() => { bookingsApi.schedule().then((r) => setSchedule(r.bookings)).catch(() => {}) }, [])
  const loadMessage = useCallback(() => {
    notificationsApi.list()
      .then((r) => setMessage(r.notifications.find((n) => !n.is_read && n.notification_type.startsWith('broadcast')) ?? null))
      .catch(() => {})
  }, [])
  useEffect(loadMessage, [loadMessage])
  const gotIt = () => { if (message) notificationsApi.markRead(message.id).catch(() => {}); setMessage(null) }

  const loadMe = useCallback(() => {
    attendanceApi.me().then(setMe).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => { loadTasks(); loadMe() }, [loadTasks, loadMe])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') { loadTasks(); loadMessage() } }
    const id = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [loadTasks, loadMessage])

  // Run an action, show its message, refresh. Attendance actions return the new state.
  const run = async (action: () => Promise<Result & Partial<MyAttendance>>, after?: () => void) => {
    setError('')
    setBusy(true)
    try {
      const r = await action()
      toast(r.message)
      if ('on_site' in r) setMe(r as MyAttendance)
      loadTasks()
      after?.()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const order = (a: Task, b: Task) =>
    Number(isFinished(a)) - Number(isFinished(b)) || byDue(a, b)
  const today = (tasks ?? []).filter((t) => !t.due_at || isToday(t.due_at) || t.is_overdue || t.status === 'flagged').sort(order)
  const later = (tasks ?? []).filter((t) => !today.includes(t) && t.status === 'todo').sort(order)
  const done = today.filter(isFinished).length
  const next = today.find((t) => t.status === 'todo' && t.due_at)

  const record = me?.today
  const onSite = !!me?.on_site
  const leftToday = record?.status === 'present' && !!record.check_out
  const absent = record?.status === 'absent'
  const canSignOff = user?.role === 'volunteer'

  return (
    <div className="m-wrap">
      <section className="m-hero">
        <Mandala />
        <div className="date">{longDate()}</div>
        <h1>{greeting()}</h1>
        <div className="hchips">
          <span className="hchip"><Icon name="check-circle" size={16} /> {tasks ? `${done} of ${today.length} tasks done` : '…'}</span>
          {next && <span className="hchip"><Icon name="clock" size={16} /> Next: {fmtTime(next.due_at)}</span>}
        </div>
        {me && (onSite ? (
          <div className="arrived">
            <Icon name="check" size={20} />
            <span className="grow">You arrived at {fmtTime(record!.check_in!)}</span>
            {me.can_undo && <button disabled={busy} onClick={() => run(attendanceApi.undoCheckIn)}>Undo</button>}
          </div>
        ) : leftToday ? (
          <div className="arrived">
            <Icon name="leave" size={20} />
            <span className="grow">You left at {fmtTime(record!.check_out!)}{record!.closing_confirmed_at && ' · locked up'}</span>
            <button disabled={busy} onClick={() => run(attendanceApi.back)}>I'm back</button>
          </div>
        ) : (
          <div className="not-in"><span className="dot" /> {absent ? `Marked absent today${record?.notes ? ` (${record.notes})` : ''}` : 'Not checked in yet'}</div>
        ))}
      </section>

      {me && !onSite && !leftToday && (
        <button className="btn-here" disabled={busy} onClick={() => run(attendanceApi.checkIn)}>
          <Icon name="check" size={30} />
          <span><b>{absent ? "I'm here after all" : "I'm here"}</b><span>Tap when you arrive</span></span>
        </button>
      )}

      {message && (
        <div className={`msg-card ${message.notification_type === 'broadcast_urgent' ? 'urgent' : ''}`} role="status">
          <div className="msg-head">
            <span><Icon name="bell" size={16} /> {message.title} · {timeAgo(message.created_at)}</span>
            <button className="btn btn-outline btn-sm" onClick={gotIt}>Got it</button>
          </div>
          <p>{message.message}</p>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {canSignOff && (
        <section>
          <div className="m-sec"><h2>Safety checks</h2><span>volunteers only</span></div>
          <p className="muted small" style={{ margin: '10px 2px' }}>These safety tasks are done. Please go and check, then sign off.</p>
          <VerifyList onChanged={loadTasks} />
        </section>
      )}

      <div className="m-sec">
        <h2>Your tasks today</h2>
        <span>{tasks ? `${done} of ${today.length} done` : ''}</span>
      </div>
      {!tasks && !error && <Spinner />}
      {tasks && !onSite && today.some((t) => t.status === 'todo') && (
        <div className="lock-note"><Icon name="lock" size={16} /> {leftToday ? 'Tap "I\'m back" above to carry on with tasks' : 'Tap "I\'m here" above to unlock and start tasks'}</div>
      )}
      {tasks && !today.length && <p className="muted">Nothing on your list today.</p>}
      {today.filter((t) => !isFinished(t)).map((t) => (
        <TaskCard key={t.id} task={t} open={openTask === t.id} locked={!onSite} busy={busy} run={run}
          onOpen={() => setOpenTask((id) => (id === t.id ? null : t.id))} onHelp={() => setHelp(t)} />
      ))}
      {done > 0 && (
        <>
          <button className="done-today" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            Done today ({done}) <Icon name="chevron-down" size={16} />
          </button>
          {showDone && today.filter(isFinished).map((t) => (
            <TaskCard key={t.id} task={t} open={openTask === t.id} locked={false} busy={busy} run={run} onOpen={() => setOpenTask((id) => (id === t.id ? null : t.id))} onHelp={() => {}} />
          ))}
        </>
      )}

      {schedule.length > 0 && (
        <>
          <div className="m-sec"><h2>Today at the temple</h2></div>
          <div className="m-list">
            {schedule.map((b) => (
              <div key={b.id} className="li">
                <span className="when">{bookingTimes(b).split(' – ')[0]}</span>
                <span className="what">{b.title}<small>{b.resource_name} · until {bookingTimes(b).split(' – ')[1]}</small></span>
              </div>
            ))}
          </div>
        </>
      )}

      {later.length > 0 && (
        <>
          <div className="m-sec"><h2>Coming up</h2></div>
          <div className="m-list">
            {later.map((t) => (
              <div key={t.id} className="li">
                <span className="when">{fmtDay(t.due_at)}</span>
                <span className="what">{t.title}<small>{fmtTime(t.due_at)}{t.area && ` · ${t.area}`}</small></span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="m-actions">
        <button className="btn btn-outline" onClick={() => setProblem('general')}><Icon name="alert" /> Report a problem</button>
        <Link className="btn btn-outline" to="/staff/bookings"><Icon name="calendar" /> My bookings</Link>
      </div>
      <Link className="link-arrow" style={{ alignSelf: 'center' }} to="/staff/book">Book a hall or room <Icon name="arrow-right" size={16} /></Link>
      {onSite && me && (
        <button className="btn btn-outline btn-big" disabled={busy} onClick={() => { loadMe(); setLeaving(true) }}><Icon name="leave" /> I'm leaving</button>
      )}
      {me && <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setHistory(true)}>My attendance (30 days)</button>}
      <button className="signout" onClick={logout}>Sign out</button>

      {problem && <ProblemSheet task={problem === 'general' ? null : problem} onClose={() => setProblem(null)} onSent={loadTasks} />}
      {help && <HelpSheet task={help} onClose={() => setHelp(null)} onSent={() => { setOpenTask(null); loadTasks() }} />}
      {leaving && me && (
        <LeavingSheet
          me={me}
          busy={busy}
          unfinished={today.filter((t) => t.status === 'todo').map((t) => t.due_at ? `${t.title} (by ${fmtTime(t.due_at)})` : t.title)}
          onClose={() => setLeaving(false)}
          onLeave={(closing?: ClosingChecks) => run(() => attendanceApi.leave(closing), () => setLeaving(false))}
        />
      )}
      {history && me && <HistoryDialog me={me} onClose={() => setHistory(false)} />}
    </div>
  )
}

// M2 task card; tapping Start opens it in place (M3 Task opened): when, where, who it's
// from, what to do, then Done or I need help (M4).
function TaskCard({ task: t, open, locked, busy, run, onOpen, onHelp }: {
  task: Task
  open: boolean
  locked: boolean
  busy: boolean
  run: (action: () => Promise<Result>) => Promise<boolean>
  onOpen: () => void
  onHelp: () => void
}) {
  const { user } = useAuth()
  const finished = isFinished(t)
  const late = t.status === 'todo' && t.is_overdue
  const tone = finished ? 's-grn done' : late ? 's-red' : t.requires_verification ? 's-saf' : ''
  const note = t.status === 'todo' && (t.last_comment_type === 'sent_back' || t.last_comment_type === 'system') ? t.last_comment : null
  const isLocked = locked && t.status === 'todo'
  const expanded = open && t.status === 'todo' && !isLocked
  const showDone = open && finished

  return (
    <div className={`m-task ${tone} ${isLocked ? 'locked' : ''} ${expanded ? 'open' : ''}`} {...(!open && ((t.status === 'todo' && !isLocked) || finished) ? rowClick(onOpen) : {})}>
      <div className="m-task-row">
        <button className="txt m-task-head" onClick={(t.status === 'todo' && !isLocked) || finished ? onOpen : undefined} aria-expanded={expanded || showDone}>
          <span className="t">{t.title}</span>
          <span className="m">
            {late ? <b className="red">Late · was due {fmtInline(t.due_at)}</b> : t.due_at ? `By ${fmtTime(t.due_at)}` : 'Any time'}
            {t.area && ` · ${t.area}`}
            {t.requires_verification && ' · Safety'}
            {t.assigned_group && ' · shared'}
          </span>
          {t.status === 'awaiting_signoff' && <span className="m saf-text">Done · waiting for a second check</span>}
          {t.verified_by_name && <span className="m" style={{ color: 'var(--green)' }}>Signed off by {t.verified_by_name}</span>}
          {t.status === 'done' && t.completed_by !== user?.id && t.completed_by_name && <span className="m">Done by {t.completed_by_name}</span>}
          {t.status === 'flagged' && <span className="m red">Asked for help: {t.last_comment}</span>}
          {t.status === 'todo' && t.last_reminded_at && isToday(t.last_reminded_at) && (
            <span className="reminded-note"><Icon name="bell" size={14} /> {t.last_reminded_by_name ? `${t.last_reminded_by_name.split(' ')[0]} sent a reminder` : 'Reminder'} · {timeAgo(t.last_reminded_at)}</span>
          )}
          {note && <span className="sentback">{t.last_comment_type === 'sent_back' ? 'Sent back: ' : ''}{note}</span>}
        </button>
        {t.status === 'todo' && !isLocked && !expanded && <button className="btn btn-outline" onClick={onOpen}>Start</button>}
        {expanded && <button className="icon-btn" onClick={onOpen} aria-label="Close"><Icon name="chevron-down" size={20} /></button>}
        {finished && <span className="tile-ic ic-grn" aria-label="Done"><Icon name="check" size={20} /></span>}
      </div>

      {expanded && (
        <div className="m-task-body">
          <div className="kv"><Icon name="clock" size={16} /><span>{t.due_at ? `By ${fmtTime(t.due_at)} ${isToday(t.due_at) ? 'today' : fmtDay(t.due_at)}` : 'Any time today'}</span></div>
          {t.area && <div className="kv"><Icon name="pin" size={16} /><span>{t.area}</span></div>}
          {t.created_by_name && <div className="kv"><Icon name="user" size={16} /><span>From {t.created_by_name.split(' ')[0]}</span></div>}
          {t.description && (
            <div className="what-to-do">
              <span className="ulabel">What to do</span>
              <p>{t.description}</p>
            </div>
          )}
          {t.requires_verification && <div className="m saf-text"><Icon name="shield" size={14} /> Safety task: someone will check it after you</div>}
          <button className="btn btn-done btn-big" disabled={busy} onClick={() => run(() => tasksApi.complete(t.id))}><Icon name="check" /> Done</button>
          <button className="btn btn-outline btn-big" onClick={onHelp}><Icon name="alert" /> I need help</button>
        </div>
      )}

      {showDone && (
        <div className="m-task-body">
          {t.completed_at && <div className="kv"><Icon name="check" size={16} /><span>Done at {fmtTime(t.completed_at)}{t.completed_by_name && ` by ${t.completed_by_name.split(' ')[0]}`}</span></div>}
          {t.verified_by_name && <div className="kv"><Icon name="shield" size={16} /><span>Checked by {t.verified_by_name.split(' ')[0]}{t.verified_at && ` at ${fmtTime(t.verified_at)}`}</span></div>}
          {t.area && <div className="kv"><Icon name="pin" size={16} /><span>{t.area}</span></div>}
          {t.created_by_name && <div className="kv"><Icon name="user" size={16} /><span>From {t.created_by_name.split(' ')[0]}</span></div>}
          {t.description && (
            <div className="what-to-do">
              <span className="ulabel">What to do</span>
              <p>{t.description}</p>
            </div>
          )}
        </div>
      )}

      {finished && !t.verified_by && t.completed_by === user?.id && (
        <button className="link-btn muted" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => tasksApi.undo(t.id))}><Icon name="undo" size={14} /> Undo</button>
      )}
    </div>
  )
}
