import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { tasksApi } from '../../api/endpoints'
import { TASK_GROUP_LABELS } from '../../constants'
import { fmtTime, fmtWhen } from '../../lib/format'
import { assigneeLabel, byDue, dueMs, isFinished, repeatLabel } from '../../lib/tasks'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { Empty, ErrorNote, Icon, Spinner, rowClick } from '../../components/ui'
import { lateBy } from '../../components/InboxRow'
import StatusBadge from '../../components/tasks/StatusBadge'
import TaskForm from '../../components/tasks/TaskForm'
import TaskDetails from '../../components/tasks/TaskDetails'
import type { Task } from '../../types'
import RemindButton from '../../components/tasks/RemindButton'
import { can, useAccess } from '../../lib/access'
import ViewOnly from '../../components/ViewOnly'
import { useAuth } from '../../auth/AuthContext'

// T1 Tasks: Today, and T2 Upcoming / All (designs: screens/16_T1, 17_T2).
// Assign work, track it, sign it off. Safety tasks need a second person.
type Tab = 'today' | 'upcoming' | 'all'
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All' },
]

const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime() }

export default function TasksPage() {
  const access = useAccess()
  const toast = useToast()
  const { refreshSummary, openBroadcast } = useAdminContext()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'today'
  const [group, setGroup] = useState('')
  const [person, setPerson] = useState('')
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(() => {
    setError('')
    const views = tab === 'today' ? (['today', 'overdue'] as const) : tab === 'upcoming' ? (['open'] as const) : (['all'] as const)
    Promise.all(views.map((view) => tasksApi.list({ view, group })))
      .then((results) => {
        const seen = new Map<number, Task>()
        results.flatMap((r) => r.tasks).forEach((t) => seen.set(t.id, t))
        setTasks([...seen.values()].sort(byDue))
      })
      .catch((e: Error) => setError(e.message))
  }, [tab, group])

  useEffect(load, [load])

  const changed = () => { load(); refreshSummary() }
  const act = async (action: () => Promise<{ message: string }>) => {
    try {
      toast((await action()).message)
      changed()
    } catch (err) {
      toast((err as Error).message)
    }
  }

  const people = useMemo(
    () => [...new Set((tasks ?? []).map((t) => t.assigned_to_name).filter(Boolean) as string[])].sort(),
    [tasks],
  )
  const q = query.trim().toLowerCase()
  const list = (tasks ?? []).filter((t) =>
    (!person || t.assigned_to_name === person) &&
    (!q || `${t.title} ${t.area ?? ''} ${t.assigned_to_name ?? ''} ${t.category}`.toLowerCase().includes(q)),
  )
  const later = tab === 'upcoming' ? list.filter((t) => t.due_at && dueMs(t) > endOfToday() && t.status === 'todo') : []

  const needs = list.filter((t) => (t.status === 'todo' && t.is_overdue) || t.status === 'flagged')
  const review = list.filter((t) => t.status === 'awaiting_signoff')
  const todo = list.filter((t) => t.status === 'todo' && !t.is_overdue)
  const done = list.filter((t) => t.status === 'done')
  // Due today, or "any time" (no deadline)
  const todayTotal = list.filter((t) => !t.due_at || new Date(t.due_at).toDateString() === new Date().toDateString())
  const todayDone = todayTotal.filter(isFinished).length

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params)
    if (id === 'today') next.delete('tab')
    else next.set('tab', id)
    setParams(next, { replace: true })
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tasks {!access.can('tasks', 'manage') && <ViewOnly />}</h1>
          <p>Assign work, track it, sign it off.</p>
        </div>
        <div className="head-actions">
          {access.allowed('broadcast') && <button className="btn btn-outline" onClick={openBroadcast}><Icon name="send" size={16} /> Broadcast</button>}
          {access.can('tasks', 'manage') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New task</button>}
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="filters">
        <label className="search">
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        </label>
        <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
          <option value="">Person: All</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Role">
          <option value="">Role: All roles</option>
          {Object.entries(TASK_GROUP_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!tasks && !error && <Spinner />}

      {tasks && tab === 'today' && (
        <>
          <section className="list-card progress-card">
            <div>
              <b>{todayDone} of {todayTotal.length} done today</b>
              <span>{todayTotal.length - todayDone} task{todayTotal.length - todayDone === 1 ? '' : 's'} remaining</span>
            </div>
            <div className="bar"><i style={{ width: `${todayTotal.length ? (todayDone / todayTotal.length) * 100 : 0}%` }} /></div>
          </section>

          <Section title="Needs attention" tone="sec-red" tasks={needs} onOpen={setViewing} act={act} />
          <Section title="Awaiting review" tone="sec-saf" tasks={review} onOpen={setViewing} act={act} />
          <Section title="To do" tone="" tasks={todo} onOpen={setViewing} act={act} />
          {!needs.length && !review.length && !todo.length && <Empty icon="check">Nothing left to do today.</Empty>}

          {done.length > 0 && (
            <>
              <button className="show-more" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                <Icon name="check-circle" size={18} /> {showDone ? 'Hide' : 'Show'} {done.length} completed task{done.length === 1 ? '' : 's'} <Icon name="chevron-down" size={16} />
              </button>
              {showDone && <Section title="Done" tone="sec-muted" tasks={done} onOpen={setViewing} act={act} />}
            </>
          )}
        </>
      )}

      {tasks && tab === 'upcoming' && (
        later.length ? <Section title="Coming up" tone="" tasks={later} onOpen={setViewing} act={act} showDay /> : <Empty icon="check">Nothing coming up.</Empty>
      )}

      {tasks && tab === 'all' && <AllTasks list={list} onOpen={setViewing} />}

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
    </div>
  )
}

function Section({ title, tone, tasks, onOpen, act, showDay }: {
  title: string
  tone: string
  tasks: Task[]
  onOpen: (id: number) => void
  act: (action: () => Promise<{ message: string }>) => void
  showDay?: boolean
}) {
  if (!tasks.length) return null
  return (
    <section>
      <h3 className={`sec-label ${tone}`}>{title} ({tasks.length})</h3>
      <div className="list-card">
        {tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} act={act} showDay={showDay} />)}
      </div>
    </section>
  )
}

function TaskRow({ task: t, onOpen, act, showDay }: {
  task: Task
  onOpen: (id: number) => void
  act: (action: () => Promise<{ message: string }>) => void
  showDay?: boolean
}) {
  const { user } = useAuth()
  const late = t.status === 'todo' && t.is_overdue
  const name = t.assigned_to_name
  const when = !t.due_at ? 'any time' : showDay ? fmtWhen(t.due_at) : `due ${fmtTime(t.due_at)}`
  return (
    <div className={`t-row row-open ${late ? 'urgent' : ''} ${t.status === 'awaiting_signoff' ? 'review' : ''}`} {...rowClick(() => onOpen(t.id))}>
      <span className="av">{name ? name[0].toUpperCase() : <Icon name="users" size={18} />}</span>
      <div className="grow">
        <div className="t-title"><button onClick={() => onOpen(t.id)}>{t.title}</button></div>
        <div className="t-meta">
          <span>{assigneeLabel(t)}</span>
          {t.area && <span>· {t.area}</span>}
          {t.status === 'awaiting_signoff' ? (
            <span>· done by {t.completed_by_name}{t.completed_at && ` ${fmtTime(t.completed_at)}`}</span>
          ) : t.status === 'done' ? (
            <span>· done{t.completed_by_name && ` by ${t.completed_by_name}`}{t.verified_by_name && `, signed off by ${t.verified_by_name}`}</span>
          ) : (
            <span>· {when}</span>
          )}
          {late && <span className="red-text">· {lateBy(t.due_at!)} overdue</span>}
          {t.status === 'flagged' && <span className="saf-text">· ⚑ Couldn't do{t.last_comment && `: ${t.last_comment}`}</span>}
        </div>
      </div>
      <div className="t-side">
        {t.requires_verification && <span className="tag tag-red">Safety</span>}
        {t.verified_by_name && <span className="tag tag-grn">2nd check ✓ {t.verified_by_name}</span>}
        {repeatLabel(t) && <span className="tag tag-ind">{repeatLabel(t)}</span>}
        {t.priority === 'high' && !t.requires_verification && <span className="tag tag-saf">High</span>}
        {late && can(user, 'tasks', 'manage') ? (
          <RemindButton task={t} act={act} className="btn btn-outline btn-sm" />
        ) : t.status === 'awaiting_signoff' ? (
          <button className="btn btn-outline btn-sm" onClick={() => onOpen(t.id)}>Review</button>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => onOpen(t.id)}>Open</button>
        )}
      </div>
    </div>
  )
}

// T2 Tasks: All (design: screens/17_T2): status chips, a table, and pages of 10.
const STATUS_CHIPS: { id: string; label: string; match: (t: Task) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'todo', label: 'To do', match: (t) => t.status === 'todo' && !t.is_overdue },
  { id: 'review', label: 'Awaiting review', match: (t) => t.status === 'awaiting_signoff' },
  { id: 'blocked', label: "Couldn't do", match: (t) => t.status === 'flagged' },
  { id: 'overdue', label: 'Overdue', match: (t) => t.status === 'todo' && t.is_overdue },
  { id: 'done', label: 'Done', match: (t) => t.status === 'done' },
]
const PAGE_SIZE = 10

function AllTasks({ list, onOpen }: { list: Task[]; onOpen: (id: number) => void }) {
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const chip = STATUS_CHIPS.find((c) => c.id === status)!
  const rows = list.filter(chip.match)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      <div className="fchips">
        {STATUS_CHIPS.map((c) => (
          <button key={c.id} className={`fchip ${status === c.id ? 'on' : ''}`} onClick={() => { setStatus(c.id); setPage(0) }}>
            {c.label} <span className="muted">{list.filter(c.match).length}</span>
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Task</th><th>Assigned to</th><th>Due</th><th>Status</th><th>For</th><th className="right">Action</th></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={`row-open ${t.is_overdue ? 'row-overdue' : ''}`} {...rowClick(() => onOpen(t.id))}>
                  <td>
                    <button className={`cell-title ${t.status === 'done' ? 'struck' : ''}`} onClick={() => onOpen(t.id)}>{t.title}</button>
                    <div className="badges">
                      {repeatLabel(t) && <span className="tag tag-grn">{repeatLabel(t)}</span>}
                      {t.requires_verification && <span className="tag tag-red">Safety</span>}
                    </div>
                  </td>
                  <td>{t.assigned_to_name ?? <span className="row" style={{ gap: 6 }}><Icon name="users" size={15} /> {assigneeLabel(t)}</span>}</td>
                  <td className={`nowrap ${t.is_overdue ? 'red-text' : ''}`}>{t.due_at ? fmtWhen(t.due_at) : 'No deadline'}</td>
                  <td><StatusBadge task={t} /></td>
                  <td>{t.booking_id ? <span className="tag tag-ind">Booking</span> : <span className="muted">—</span>}</td>
                  <td className="right"><button className="link-btn" onClick={() => onOpen(t.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-foot">
            <span className="muted small">Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {rows.length}</span>
            {pages > 1 && (
              <div className="pager">
                <button className="icon-btn" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page"><Icon name="arrow-left" size={16} /></button>
                {Array.from({ length: pages }, (_, i) => (
                  <button key={i} className={`pg ${i === current ? 'on' : ''}`} onClick={() => setPage(i)}>{i + 1}</button>
                ))}
                <button className="icon-btn" disabled={current === pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page"><Icon name="arrow-right" size={16} /></button>
              </div>
            )}
          </div>
        </div>
      ) : <Empty icon="check">No tasks here.</Empty>}
    </>
  )
}
