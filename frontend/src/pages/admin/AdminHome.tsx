import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { attendanceApi, issuesApi, tasksApi, usersApi } from '../../api/endpoints'
import { BRAND } from '../../branding'
import { TASK_GROUP_LABELS, jobLabel } from '../../constants'
import { fmtInline, fmtTime, fmtWhen, longDate, timeAgo } from '../../lib/format'
import { assigneeLabel, isFinished, suggestGroup } from '../../lib/tasks'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, Empty, ErrorNote, Icon, Spinner } from '../../components/ui'
import { Gopuram, Mandala, Toran } from '../../components/Ornaments'
import CheckInCard from '../../components/attendance/CheckInCard'
import ConvertIssueForm from '../../components/tasks/ConvertIssueForm'
import StatusBadge from '../../components/tasks/StatusBadge'
import TaskDetails from '../../components/tasks/TaskDetails'
import TaskForm from '../../components/tasks/TaskForm'
import type { AttendanceDay, Issue, Task, TaskSummary, User } from '../../types'

// Dashboard for the chairman and committee, laid out as in the prototype
// (src/prototype/admin/Dashboard.jsx) but on real data:
//   banner · Today (ring, chips, lanes) + Who's on · Needs your attention + Today in brief + Your follow-ups
// Phase 3 adds an Events lane (bookings), the request bar and the AI summary.

interface Data {
  today: Task[]
  overdue: Task[]
  mine: Task[]
  issues: Issue[]
  pending: User[]
  day: AttendanceDay | null
}

type Action = () => Promise<{ message: string }>

const DAY_MS = 86_400_000
const SHOW_MAX = 6
const byDue = (a: Task, b: Task) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const orList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : items[0])

export default function AdminHome() {
  const { user } = useAuth()
  const toast = useToast()
  const { summary, refreshSummary } = useAdminContext()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [converting, setConverting] = useState<Issue | null>(null)

  const load = useCallback(() => {
    Promise.all([
      tasksApi.list({ view: 'today' }),
      tasksApi.list({ view: 'overdue' }),
      tasksApi.list({ view: 'mine' }),
      issuesApi.list('open'),
      usersApi.list(),
      attendanceApi.day().catch(() => null),
    ])
      .then(([today, overdue, mine, issues, people, day]) => {
        setError('')
        setData({
          today: today.tasks,
          overdue: overdue.tasks.sort(byDue),
          mine: mine.tasks.sort(byDue),
          issues: issues.issues,
          pending: people.users.filter((p) => p.approval_status === 'pending'),
          day,
        })
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const changed = () => { load(); refreshSummary() }
  const act = async (action: Action) => {
    try {
      toast((await action()).message)
      changed()
    } catch (err) {
      toast((err as Error).message)
    }
  }

  if (!user) return null
  const isChairman = user.role === 'chairman'
  const firstName = user.full_name.split(' ')[0]

  return (
    <div className="page">
      <section className="temple-band">
        <Toran />
        <Mandala />
        <Gopuram />
        <div className="band-eyebrow">{longDate()} · {BRAND.templeName}</div>
        <h1>Namaste, {firstName}</h1>
        <p className="band-line">{data ? bandLine(data) : ' '}</p>
        <div className="band-actions">
          <button className="btn btn-light" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New task</button>
          <Link to="/admin/attendance" className="btn btn-glass"><Icon name="clock" size={16} /> Who's on</Link>
        </div>
      </section>

      <ErrorNote>{error}</ErrorNote>
      {!data && !error && <Spinner />}

      {data && (
        <>
          <div className="top-row">
            <Today data={data} summary={summary} isChairman={isChairman} />
            <WhosOn day={data.day} />
          </div>

          <div className="grid-2">
            <Attention data={data} isChairman={isChairman} myId={user.id} onConvert={setConverting} onOpen={setViewing} act={act} />
            <div className="side-col">
              <Brief data={data} isChairman={isChairman} />
              <FollowUps tasks={data.mine} onOpen={setViewing} act={act} />
              <CheckInCard optIn />
            </div>
          </div>
        </>
      )}

      {creating && (
        <TaskForm
          showTemplates
          allowMany
          onClose={() => setCreating(false)}
          onSubmit={async (inputs) => {
            const r = await tasksApi.create(inputs)
            toast(r.message)
            setCreating(false)
            changed()
          }}
        />
      )}
      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {converting && <ConvertIssueForm issue={converting} onClose={() => setConverting(null)} onDone={(m) => { toast(m); setConverting(null); changed() }} />}
    </div>
  )
}

function bandLine({ today, day }: Data): string {
  const done = today.filter(isFinished).length
  const tasks = today.length ? `${done} of ${today.length} tasks done today` : 'No tasks due today'
  if (!day) return tasks
  const here = day.counts.here
  return `${tasks} · ${here ? `${here} ${here === 1 ? 'person' : 'people'} on site` : 'nobody on site yet'}`
}

// ---------------------------------------------------------------- Today

function Today({ data, summary, isChairman }: { data: Data; summary: TaskSummary | null; isChairman: boolean }) {
  const { today, issues, pending } = data
  const done = today.filter((t) => t.status === 'done').length
  const awaiting = today.filter((t) => t.status === 'awaiting_signoff').length
  const flagged = today.filter((t) => t.status === 'flagged').length
  const todo = today.filter((t) => t.status === 'todo').sort(byDue)
  const next = todo.find((t) => !t.is_overdue)
  const late = todo.filter((t) => t.is_overdue).length

  const overdueCount = summary?.overdue ?? data.overdue.length
  const signoffCount = summary?.awaiting_signoff ?? awaiting

  const checks = today.filter((t) => !t.requires_verification)
  const safety = today.filter((t) => t.requires_verification)
  const nextOf = (list: Task[]) => list.filter((t) => t.status === 'todo').sort(byDue)[0]
  const safetyAwaiting = safety.filter((t) => t.status === 'awaiting_signoff').length

  let headline: string
  let sub: string
  if (next) {
    headline = `Next: ${next.title}`
    sub = [next.area, fmtTime(next.due_at), assigneeLabel(next)].filter(Boolean).join(' · ')
  } else if (late) {
    headline = `${plural(late, 'task')} from today ${late === 1 ? 'is' : 'are'} late`
    sub = 'Send a reminder from "Needs your attention" below.'
  } else if (today.length) {
    headline = 'Everything for today is done'
    sub = [awaiting && `${awaiting} waiting for a second check`, flagged && `${flagged} couldn't be done`].filter(Boolean).join(' · ') || 'A quiet rest of the day.'
  } else {
    headline = 'No tasks today'
    sub = 'A quiet day.'
  }

  return (
    <section className="today">
      <div className="today-top">
        <Ring total={today.length} done={done} awaiting={awaiting} />
        <div className="grow">
          <div className="eyebrow">Today</div>
          <h2 className="today-headline">{headline}</h2>
          <div className="muted">{sub}</div>
          <div className="today-flags">
            {overdueCount > 0 && <Link className="pill pill-red" to="/admin/tasks?view=overdue">{overdueCount} overdue</Link>}
            {issues.length > 0 && <Link className="pill pill-red" to="/admin/issues">{plural(issues.length, 'open issue')}</Link>}
            {signoffCount > 0 && <Link className="pill pill-amber" to="/admin/signoffs">{signoffCount} waiting for sign-off</Link>}
            {isChairman && pending.length > 0 && <Link className="pill pill-amber" to="/admin/people">{plural(pending.length, 'registration')} to approve</Link>}
          </div>
        </div>
      </div>

      <div className="swipe lanes">
        <Lane
          to="/admin/tasks"
          title="Daily checks"
          value={checks.filter(isFinished).length}
          total={checks.length}
          next={nextOf(checks)}
          note={checks.length ? 'All done' : 'None today'}
        />
        <Lane
          to="/admin/signoffs"
          title="Safety & closing"
          value={safety.filter((t) => t.status === 'done').length}
          total={safety.length}
          tone="amber"
          next={nextOf(safety)}
          note={!safety.length ? 'None today' : safetyAwaiting ? `${safetyAwaiting} done, needs a second check` : 'Signed off by a second person'}
        />
        <Link className="lane" to="/admin/issues">
          <div className="lane-head">
            <span className="lane-title">Problems reported</span>
            <span className="lane-num">{issues.length} <small>open</small></span>
          </div>
          <div className="lane-list">
            {issues.slice(0, 2).map((i) => <div key={i.id} className="clip"><b>{i.category}</b> · {i.description}</div>)}
            {issues.length > 2 && <div className="muted">+{issues.length - 2} more</div>}
            {!issues.length && <div>Nothing reported. All clear.</div>}
          </div>
        </Link>
      </div>
    </section>
  )
}

function Lane({ to, title, value, total, next, note, tone = 'green' }: {
  to: string; title: string; value: number; total: number; next?: Task; note: string; tone?: 'green' | 'amber'
}) {
  const pct = total ? (value / total) * 100 : 0
  return (
    <Link className="lane" to={to}>
      <div className="lane-head">
        <span className="lane-title">{title}</span>
        <span className="lane-num">{value}<small>/{total}</small></span>
      </div>
      <div className={`lane-bar lane-${tone}`}><span style={{ width: `${pct}%` }} /></div>
      <div className="lane-next">{next ? <>Next: {next.title} · <b>{fmtTime(next.due_at)}</b></> : note}</div>
    </Link>
  )
}

// Green = done, amber = done but waiting for a second person's sign-off.
function Ring({ total, done, awaiting }: { total: number; done: number; awaiting: number }) {
  const r = 46
  const c = 2 * Math.PI * r
  const dLen = total ? (done / total) * c : 0
  const aLen = total ? (awaiting / total) * c : 0
  return (
    <div className="ring" role="img" aria-label={`${done} of ${total} tasks done, ${awaiting} waiting for sign-off`}>
      <svg viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} className="ring-track" />
        <circle cx="55" cy="55" r={r} className="ring-amber" strokeDasharray={`${aLen} ${c}`} strokeDashoffset={-dLen} />
        <circle cx="55" cy="55" r={r} className="ring-green" strokeDasharray={`${dLen} ${c}`} />
      </svg>
      <div className="ring-label">
        <span className="ring-num">{done}<small>/{total}</small></span>
        <span className="ring-sub">done</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Who's on

function WhosOn({ day }: { day: AttendanceDay | null }) {
  if (!day) return null
  const here = day.people.filter((p) => p.state === 'here')
  const left = day.people.filter((p) => p.state === 'left')
  return (
    <section className="panel whos-on">
      <div className="panel-head">
        <h2>Who's on today</h2>
        <span className="muted small">{day.counts.here} here</span>
      </div>
      <div className="stack-tight">
        {here.map((p) => (
          <div key={p.user_id} className="whos-row">
            <Avatar name={p.full_name} size={30} />
            <div className="grow">
              <div>{p.full_name}</div>
              <div className="meta">{jobLabel(p)}</div>
            </div>
            {p.check_in && <span className="here">{fmtTime(p.check_in)}</span>}
          </div>
        ))}
        {left.map((p) => (
          <div key={p.user_id} className="whos-row whos-left">
            <Avatar name={p.full_name} size={30} />
            <div className="grow">
              <div>{p.full_name}</div>
              <div className="meta">{jobLabel(p)}</div>
            </div>
            {p.check_out && <span className="small">Left {fmtTime(p.check_out)}</span>}
          </div>
        ))}
        {!here.length && !left.length && <p className="muted small">Nobody has checked in yet today.</p>}
        {day.gaps.length > 0 && (
          <div className="whos-row whos-gap">
            <span className="gap-mark">!</span>
            <div className="grow">
              <div>No {orList(day.gaps.map((g) => TASK_GROUP_LABELS[g].toLowerCase()))} in today</div>
              <div className="meta">Nobody with {day.gaps.length === 1 ? 'this job' : 'these jobs'} has checked in</div>
            </div>
          </div>
        )}
      </div>
      <div className="whos-foot">
        <span className="muted small">{day.counts.not_in} not in yet{day.counts.absent ? ` · ${day.counts.absent} absent` : ''}</span>
        <Link to="/admin/attendance" className="link-btn">See everyone</Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Needs your attention

function Attention({ data, isChairman, myId, onConvert, onOpen, act }: {
  data: Data
  isChairman: boolean
  myId: number
  onConvert: (issue: Issue) => void
  onOpen: (taskId: number) => void
  act: (action: Action) => void
}) {
  const { issues, overdue, pending } = data
  const showPending = isChairman && pending.length > 0
  const nothing = !issues.length && !overdue.length && !showPending

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Needs your attention</h2>
        <span className="muted small desk">Ready to act on, one click each</span>
      </div>
      {nothing && <Empty icon="check">All clear. Nothing waiting for you.</Empty>}
      <div className="stack">
        {showPending && (
          <div className="attn attn-request">
            <span className="desk"><Icon name="users" /></span>
            <div className="grow">
              <div className="attn-title">{plural(pending.length, 'registration')} waiting for you</div>
              <div className="meta">{pending.map((p) => p.full_name).join(', ')}</div>
            </div>
            <Link to="/admin/people" className="btn btn-sm btn-primary">Review</Link>
          </div>
        )}

        {issues.slice(0, SHOW_MAX).map((i) => (
          <div key={i.id} className="attn attn-issue">
            <span className="desk"><Icon name="flag" /></span>
            <div className="grow">
              <div className="attn-title">{i.description}</div>
              <div className="meta">
                {i.category} · {i.reported_by_name ?? 'Someone'} · {timeAgo(i.created_at)}
                {i.task_title && <> · on "{i.task_title}"</>}
              </div>
              <div className="suggest desk"><Icon name="sparkle" size={14} /> Suggested: assign to <b>{TASK_GROUP_LABELS[suggestGroup(i.description)]}</b></div>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => onConvert(i)}>Create task</button>
          </div>
        ))}
        {issues.length > SHOW_MAX && <Link to="/admin/issues" className="link-btn">See all {issues.length} issues</Link>}

        {overdue.slice(0, SHOW_MAX).map((t) => {
          const days = Math.floor((Date.now() - new Date(t.due_at).getTime()) / DAY_MS)
          const mine = t.assigned_to === myId
          const escalated = days >= 1 && !mine
          return (
            <div key={t.id} className={`attn attn-overdue ${escalated ? 'attn-escalated' : ''}`}>
              <span className="desk"><Icon name="clock" /></span>
              <div className="grow">
                <div className="attn-title">
                  <button className="cell-title" onClick={() => onOpen(t.id)}>{t.title}</button>
                  {escalated && <> <Badge tone="red">Overdue {plural(days, 'day')}</Badge></>}
                </div>
                <div className="meta">
                  {assigneeLabel(t)} · <span className="red">due {fmtInline(t.due_at)}</span>
                  {mine
                    ? ' · your own task'
                    : t.last_reminded_at
                      ? ` · reminded ${t.reminder_count > 1 ? `${t.reminder_count} times, last ` : ''}${timeAgo(t.last_reminded_at)}`
                      : ' · not reminded yet'}
                </div>
                {escalated && (
                  <div className="suggest desk">
                    <Icon name="sparkle" size={14} /> {t.last_reminded_at ? 'Still not done after a reminder. Give it to someone else?' : 'Send a reminder, or give it to someone else.'}
                  </div>
                )}
              </div>
              <div className="attn-btns">
                {mine
                  ? <button className="btn btn-sm btn-outline" onClick={() => act(() => tasksApi.complete(t.id))}>Mark done</button>
                  : <button className="btn btn-sm btn-outline" onClick={() => act(() => tasksApi.remind(t.id))}>Remind</button>}
                {escalated && <button className="btn btn-sm btn-primary" onClick={() => onOpen(t.id)}>Reassign</button>}
              </div>
            </div>
          )
        })}
        {overdue.length > SHOW_MAX && <Link to="/admin/tasks?view=overdue" className="link-btn">See all {overdue.length} overdue tasks</Link>}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Today in brief

function briefLines({ today, overdue, issues, pending, day }: Data, isChairman: boolean): string[] {
  const lines: string[] = []
  const done = today.filter(isFinished).length
  const awaiting = today.filter((t) => t.status === 'awaiting_signoff').length
  lines.push(today.length
    ? `${done} of ${today.length} tasks done today${awaiting ? ` (${awaiting} still need a second check)` : ''}.`
    : 'No tasks were due today.')
  lines.push(overdue.length
    ? `${overdue.length} overdue: ${overdue.slice(0, 3).map((t) => t.title).join(', ')}${overdue.length > 3 ? ' and more' : ''}.`
    : 'Nothing is overdue.')
  if (issues.length) lines.push(`${plural(issues.length, 'reported problem')} not sorted yet.`)
  if (day) {
    const here = day.counts.here
    lines.push(here ? `${here} ${here === 1 ? 'person' : 'people'} on site now.` : 'Nobody is on site right now.')
    if (day.gaps.length) lines.push(`No ${orList(day.gaps.map((g) => TASK_GROUP_LABELS[g].toLowerCase()))} in today.`)
    if (day.closing) {
      lines.push(day.closing.confirmed
        ? `Locked up by ${day.closing.by} at ${fmtTime(day.closing.at)}.`
        : `${day.closing.by} left at ${fmtTime(day.closing.at)} without finishing the closing checks.`)
    }
  }
  if (isChairman && pending.length) lines.push(`${plural(pending.length, 'registration')} waiting for your approval.`)
  return lines
}

function Brief({ data, isChairman }: { data: Data; isChairman: boolean }) {
  const toast = useToast()
  const lines = briefLines(data, isChairman)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${BRAND.templeName}: ${longDate()}\n\n- ${lines.join('\n- ')}`)
      toast('Copied. Paste it into an email or WhatsApp.')
    } catch {
      toast("Couldn't copy on this browser.")
    }
  }
  return (
    <section className="panel ai-panel">
      <div className="panel-head">
        <h2>Today in brief</h2>
        <Badge tone="blue">Automatic</Badge>
      </div>
      <ul className="summary">
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <div className="row">
        <button className="btn btn-sm btn-outline" onClick={copy}><Icon name="copy" size={15} /> Copy as email</button>
        <span className="muted small desk">Made from today's records.</span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Your follow-ups

function FollowUps({ tasks, onOpen, act }: { tasks: Task[]; onOpen: (id: number) => void; act: (action: Action) => void }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Your follow-ups</h2>
        <span className="muted small">{tasks.length} open</span>
      </div>
      {tasks.length ? (
        <div>
          {tasks.map((t) => (
            <div key={t.id} className="row-item">
              <button
                className={`tick tick-sm ${isFinished(t) ? 'on' : ''}`}
                disabled={t.status !== 'todo'}
                onClick={() => act(() => tasksApi.complete(t.id))}
                aria-label={`Mark "${t.title}" as done`}
              >
                <Icon name="check" size={16} />
              </button>
              <div className="grow">
                <button className="cell-title" onClick={() => onOpen(t.id)}>{t.title}</button>
                <div className="meta">{fmtWhen(t.due_at)}{t.assigned_group && ` · ${assigneeLabel(t)}`}</div>
              </div>
              <StatusBadge task={t} />
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="check">Nothing on your list.</Empty>
      )}
    </section>
  )
}
