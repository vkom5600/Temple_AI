import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { tasksApi } from '../../api/endpoints'
import { TASK_GROUP_LABELS } from '../../constants'
import { fmtTime, fmtWhen } from '../../lib/format'
import { assigneeLabel, isFinished, repeatLabel } from '../../lib/tasks'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { Empty, ErrorNote, Icon, Spinner } from '../../components/ui'
import { lateBy } from '../../components/InboxRow'
import StatusBadge from '../../components/tasks/StatusBadge'
import TaskForm from '../../components/tasks/TaskForm'
import TaskDetails from '../../components/tasks/TaskDetails'
import type { Task } from '../../types'

// T1 Tasks: Today, and T2 Upcoming / All (designs: screens/16_T1, 17_T2).
// Assign work, track it, sign it off. Safety tasks need a second person.
type Tab = 'today' | 'upcoming' | 'all'
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All' },
]

const byDue = (a: Task, b: Task) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime() }

export default function TasksPage() {
  const toast = useToast()
  const { refreshSummary } = useAdminContext()
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
  const later = tab === 'upcoming' ? list.filter((t) => new Date(t.due_at).getTime() > endOfToday() && t.status === 'todo') : []

  const needs = list.filter((t) => (t.status === 'todo' && t.is_overdue) || t.status === 'flagged')
  const review = list.filter((t) => t.status === 'awaiting_signoff')
  const todo = list.filter((t) => t.status === 'todo' && !t.is_overdue)
  const done = list.filter((t) => t.status === 'done')
  const todayTotal = list.filter((t) => new Date(t.due_at).getTime() <= endOfToday() && new Date(t.due_at).toDateString() === new Date().toDateString())
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
          <h1>Tasks</h1>
          <p>Assign work, track it, sign it off.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New task</button>
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

      {tasks && tab === 'all' && (
        list.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Task</th><th>Assigned to</th><th>Where</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className={t.is_overdue ? 'row-overdue' : ''}>
                    <td>
                      <button className="cell-title" onClick={() => setViewing(t.id)}>{t.title}</button>
                      <div className="badges">
                        <span className="tag tag-ind">{t.category}</span>
                        {repeatLabel(t) && <span className="tag tag-grn">{repeatLabel(t)}</span>}
                        {t.requires_verification && <span className="tag tag-red">Safety</span>}
                      </div>
                    </td>
                    <td>{assigneeLabel(t)}</td>
                    <td>{t.area ?? '—'}</td>
                    <td className="nowrap">{fmtWhen(t.due_at)}</td>
                    <td><StatusBadge task={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon="check">No tasks.</Empty>
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
  const late = t.status === 'todo' && t.is_overdue
  const name = t.assigned_to_name
  const when = showDay ? fmtWhen(t.due_at) : `due ${fmtTime(t.due_at)}`
  return (
    <div className={`t-row ${late ? 'urgent' : ''} ${t.status === 'awaiting_signoff' ? 'review' : ''}`}>
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
          {late && <span className="red-text">· {lateBy(t.due_at)} overdue</span>}
          {t.status === 'flagged' && <span className="saf-text">· ⚑ Couldn't do{t.last_comment && `: ${t.last_comment}`}</span>}
        </div>
      </div>
      <div className="t-side">
        {t.requires_verification && <span className="tag tag-red">Safety</span>}
        {t.verified_by_name && <span className="tag tag-grn">2nd check ✓ {t.verified_by_name}</span>}
        {repeatLabel(t) && <span className="tag tag-ind">{repeatLabel(t)}</span>}
        {t.priority === 'high' && !t.requires_verification && <span className="tag tag-saf">High</span>}
        {late ? (
          <button className="btn btn-outline btn-sm" onClick={() => act(() => tasksApi.remind(t.id))}>Remind</button>
        ) : t.status === 'awaiting_signoff' ? (
          <button className="btn btn-outline btn-sm" onClick={() => onOpen(t.id)}>Review</button>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => onOpen(t.id)}>Open</button>
        )}
      </div>
    </div>
  )
}
