import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { fmtDay, fmtInline, fmtTime, greeting, isToday, longDate, partOfDay } from '../../lib/format'
import { isFinished } from '../../lib/tasks'
import { useToast } from '../../components/Toast'
import { Badge, Empty, ErrorNote, Icon, Spinner } from '../../components/ui'
import ProblemSheet from '../../components/tasks/ProblemSheet'
import VerifyList from '../../components/tasks/VerifyList'
import type { Task } from '../../types'

// Mobile-first and deliberately simple: a tick list, and one way to report a problem.
// Volunteers also get a Sign-offs tab for checking safety tasks.
export default function StaffHome() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'tasks' | 'signoffs'>('tasks')
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')
  const [problem, setProblem] = useState<Task | 'general' | null>(null)
  const canSignOff = user?.role === 'volunteer'

  const load = useCallback(() => {
    tasksApi.list().then((r) => setTasks(r.tasks)).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const order = (a: Task, b: Task) =>
    Number(isFinished(a)) - Number(isFinished(b)) || new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  const today = (tasks ?? []).filter((t) => isToday(t.due_at) || t.is_overdue || t.status === 'flagged').sort(order)
  const later = (tasks ?? []).filter((t) => !today.includes(t) && t.status === 'todo').sort(order)
  const done = today.filter(isFinished).length

  return (
    <>
      <section className={`day-hero day-${partOfDay()}`}>
        <Mandala />
        <div className="day-top">
          <span className="day-date">{longDate()}</span>
        </div>
        <h1 className="day-title">{greeting()}</h1>
        <div className="day-events">
          {tasks && <span className="day-quiet">{today.length ? `${done} of ${today.length} tasks done` : 'Nothing on your list today'}</span>}
        </div>
      </section>

      {canSignOff && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>My tasks</button>
          <button role="tab" aria-selected={tab === 'signoffs'} className={tab === 'signoffs' ? 'on' : ''} onClick={() => setTab('signoffs')}>Sign-offs</button>
        </div>
      )}

      {tab === 'signoffs' ? (
        <section className="m-section">
          <p className="muted">These safety tasks are done. Please go and check, then sign off.</p>
          <VerifyList />
        </section>
      ) : (
        <>
          <ErrorNote>{error}</ErrorNote>
          {!tasks && !error && <Spinner />}

          {tasks && (
            <section className="m-section">
              <div className="progress-row">
                <h2>Today</h2>
                <span className="muted">{done} of {today.length} done</span>
              </div>
              <div className="progress" aria-hidden="true"><span style={{ width: `${today.length ? (done / today.length) * 100 : 0}%` }} /></div>
              {today.length ? (
                <div className="stack">
                  {today.map((t) => <TaskCard key={t.id} task={t} onChanged={load} onProblem={() => setProblem(t)} />)}
                </div>
              ) : (
                <Empty icon="check">No tasks today.</Empty>
              )}
            </section>
          )}

          {later.length > 0 && (
            <section className="m-section">
              <h2>Coming up</h2>
              <div className="stack">
                {later.map((t) => (
                  <div key={t.id} className="card later">
                    <div className="task-title">{t.title}</div>
                    <div className="meta">{fmtDay(t.due_at)}, {fmtTime(t.due_at)}{t.area && ` · ${t.area}`}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button className="btn btn-outline btn-block btn-lg report-btn" onClick={() => setProblem('general')}>
            <Icon name="alert" /> Report a problem
          </button>
        </>
      )}

      {problem && <ProblemSheet task={problem === 'general' ? null : problem} onClose={() => setProblem(null)} onSent={load} />}
    </>
  )
}

function TaskCard({ task: t, onChanged, onProblem }: { task: Task; onChanged: () => void; onProblem: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finished = isFinished(t)

  const run = async (action: () => Promise<{ message: string }>) => {
    setError('')
    setBusy(true)
    try {
      toast((await action()).message)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const note = t.status === 'todo' && (t.last_comment_type === 'sent_back' || t.last_comment_type === 'system') ? t.last_comment : null

  return (
    <div className={`card task ${finished ? 'finished' : ''} ${t.is_overdue ? 'overdue' : ''} ${t.status === 'flagged' ? 'flagged' : ''}`}>
      <button
        className={`tick ${finished ? 'on' : ''}`}
        onClick={t.status === 'todo' ? () => run(() => tasksApi.complete(t.id)) : undefined}
        disabled={t.status !== 'todo' || busy}
        aria-label={finished ? `"${t.title}" is done` : `Mark "${t.title}" as done`}
      >
        <Icon name="check" size={26} />
      </button>
      <div className="task-body">
        <div className="task-title">{t.title}</div>
        <div className="meta">
          {t.is_overdue ? <b className="red">Was due {fmtInline(t.due_at)}</b> : fmtTime(t.due_at)}
          {t.area && ` · ${t.area}`}
        </div>
        <div className="badges">
          {t.requires_verification && t.status === 'todo' && <Badge tone="amber">Needs a second check</Badge>}
          {t.status === 'awaiting_signoff' && <Badge tone="amber">Done · waiting for sign-off</Badge>}
          {t.verified_by_name && <Badge tone="green">Signed off by {t.verified_by_name}</Badge>}
          {t.status === 'flagged' && <Badge tone="red">Reported: {t.last_comment}</Badge>}
          {t.status === 'done' && t.completed_by !== user?.id && t.completed_by_name && <Badge tone="green">Done by {t.completed_by_name}</Badge>}
        </div>
        {t.description && t.status === 'todo' && <div className="muted small">{t.description}</div>}
        {note && <div className="sentback">{t.last_comment_type === 'sent_back' ? 'Sent back: ' : ''}{note}</div>}
        {t.status === 'todo' && (
          <button className="link-btn" onClick={onProblem}><Icon name="flag" size={14} /> Can't do this?</button>
        )}
        {finished && !t.verified_by && t.completed_by === user?.id && (
          <button className="link-btn muted" disabled={busy} onClick={() => run(() => tasksApi.undo(t.id))}><Icon name="undo" size={14} /> Undo</button>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </div>
  )
}

function Mandala() {
  const petals = (n: number, r: number, rx: number, ry: number) =>
    Array.from({ length: n }, (_, i) => (
      <ellipse key={`${r}-${i}`} cx="0" cy={-r} rx={rx} ry={ry} transform={`rotate(${(360 / n) * i})`} />
    ))
  return (
    <svg className="mandala" viewBox="-100 -100 200 200" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle r="96" /><circle r="78" /><circle r="14" />
        {petals(16, 60, 10, 24)}
        {petals(8, 32, 9, 18)}
      </g>
    </svg>
  )
}
