import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { fmtDay, fmtInline, fmtTime, greeting, isToday, longDate } from '../../lib/format'
import { isFinished } from '../../lib/tasks'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import { Mandala } from '../../components/Ornaments'
import { HistoryDialog, LeavingSheet } from '../../components/attendance/CheckInCard'
import ProblemSheet from '../../components/tasks/ProblemSheet'
import VerifyList from '../../components/tasks/VerifyList'
import type { ClosingChecks, MyAttendance, Task } from '../../types'

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
  const [leaving, setLeaving] = useState(false)
  const [history, setHistory] = useState(false)

  const loadTasks = useCallback(() => {
    tasksApi.list().then((r) => setTasks(r.tasks)).catch((e: Error) => setError(e.message))
  }, [])
  const loadMe = useCallback(() => {
    attendanceApi.me().then(setMe).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => { loadTasks(); loadMe() }, [loadTasks, loadMe])

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
    Number(isFinished(a)) - Number(isFinished(b)) || new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  const today = (tasks ?? []).filter((t) => isToday(t.due_at) || t.is_overdue || t.status === 'flagged').sort(order)
  const later = (tasks ?? []).filter((t) => !today.includes(t) && t.status === 'todo').sort(order)
  const done = today.filter(isFinished).length
  const next = today.find((t) => t.status === 'todo')

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
      {today.map((t) => (
        <TaskCard key={t.id} task={t} locked={!onSite} busy={busy} run={run} onProblem={() => setProblem(t)} />
      ))}

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
      </div>
      {onSite && me && (
        <button className="btn btn-outline btn-big" disabled={busy} onClick={() => { loadMe(); setLeaving(true) }}><Icon name="leave" /> I'm leaving</button>
      )}
      {me && <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setHistory(true)}>My attendance (30 days)</button>}
      <button className="signout" onClick={logout}>Sign out</button>

      {problem && <ProblemSheet task={problem === 'general' ? null : problem} onClose={() => setProblem(null)} onSent={loadTasks} />}
      {leaving && me && (
        <LeavingSheet
          me={me}
          busy={busy}
          unfinished={today.filter((t) => t.status === 'todo').map((t) => `${t.title} (by ${fmtTime(t.due_at)})`)}
          onClose={() => setLeaving(false)}
          onLeave={(closing?: ClosingChecks) => run(() => attendanceApi.leave(closing), () => setLeaving(false))}
        />
      )}
      {history && me && <HistoryDialog me={me} onClose={() => setHistory(false)} />}
    </div>
  )
}

function TaskCard({ task: t, locked, busy, run, onProblem }: {
  task: Task
  locked: boolean
  busy: boolean
  run: (action: () => Promise<Result>) => Promise<boolean>
  onProblem: () => void
}) {
  const { user } = useAuth()
  const finished = isFinished(t)
  const late = t.status === 'todo' && t.is_overdue
  const tone = finished ? 's-grn done' : late ? 's-red' : t.requires_verification ? 's-saf' : ''
  const note = t.status === 'todo' && (t.last_comment_type === 'sent_back' || t.last_comment_type === 'system') ? t.last_comment : null
  const isLocked = locked && t.status === 'todo'

  return (
    <div className={`m-task ${tone} ${isLocked ? 'locked' : ''}`}>
      <div className="txt">
        <div className="t">{t.title}</div>
        <div className="m">
          {late ? <b className="red">Was due {fmtInline(t.due_at)}</b> : `By ${fmtTime(t.due_at)}`}
          {t.area && ` · ${t.area}`}
          {t.requires_verification && ' · Safety'}
          {t.assigned_group && ' · shared'}
        </div>
        {t.status === 'awaiting_signoff' && <div className="m saf-text">Done · waiting for a second check</div>}
        {t.verified_by_name && <div className="m" style={{ color: 'var(--green)' }}>Signed off by {t.verified_by_name}</div>}
        {t.status === 'done' && t.completed_by !== user?.id && t.completed_by_name && <div className="m">Done by {t.completed_by_name}</div>}
        {t.status === 'flagged' && <div className="m red">Reported: {t.last_comment}</div>}
        {note && <div className="sentback">{t.last_comment_type === 'sent_back' ? 'Sent back: ' : ''}{note}</div>}
        {!isLocked && (
          <div className="links">
            {t.status === 'todo' && <button className="link-btn" onClick={onProblem}><Icon name="flag" size={14} /> Can't do this?</button>}
            {finished && !t.verified_by && t.completed_by === user?.id && (
              <button className="link-btn muted" disabled={busy} onClick={() => run(() => tasksApi.undo(t.id))}><Icon name="undo" size={14} /> Undo</button>
            )}
          </div>
        )}
      </div>
      {t.status === 'todo' && !isLocked && (
        <button className="btn btn-primary" disabled={busy} onClick={() => run(() => tasksApi.complete(t.id))}>Done</button>
      )}
      {finished && <span className="tile-ic ic-grn" aria-label="Done"><Icon name="check" size={20} /></span>}
    </div>
  )
}
