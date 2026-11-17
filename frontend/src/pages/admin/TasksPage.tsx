import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { tasksApi } from '../../api/endpoints'
import { TASK_GROUP_LABELS } from '../../constants'
import { fmtWhen } from '../../lib/format'
import { assigneeLabel, repeatLabel } from '../../lib/tasks'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { Badge, Empty, ErrorNote, Icon, Spinner } from '../../components/ui'
import StatusBadge from '../../components/tasks/StatusBadge'
import TaskForm from '../../components/tasks/TaskForm'
import TaskDetails from '../../components/tasks/TaskDetails'
import type { Task, TaskView } from '../../types'

const VIEWS: { id: TaskView; label: string }[] = [
  { id: 'open', label: 'All open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'signoff', label: 'Waiting for sign-off' },
  { id: 'flagged', label: "Couldn't do" },
  { id: 'done', label: 'Done (7 days)' },
  { id: 'all', label: 'Everything' },
]

// Chairman / committee: every task, filtered. Create, open, edit, remind, cancel.
export default function TasksPage() {
  const toast = useToast()
  const { refreshSummary } = useAdminContext()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as TaskView) || 'open'
  const group = params.get('group') ?? ''
  const [category, setCategory] = useState('')
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)

  const load = useCallback(() => {
    setError('')
    tasksApi.list({ view, group }).then((r) => setTasks(r.tasks)).catch((e: Error) => setError(e.message))
  }, [view, group])

  useEffect(load, [load])

  const changed = () => { load(); refreshSummary() }
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const categories = [...new Set(tasks?.map((t) => t.category) ?? [])].sort()
  const list = tasks?.filter((t) => !category || t.category === category) ?? []

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">Only the chairman and committee create tasks. Staff tick them off or report a problem.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New task</button>
      </header>

      <div className="toolbar">
        <div className="seg seg-inline" role="tablist" aria-label="Which tasks">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => setParam('view', v.id === 'open' ? '' : v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <select value={group} onChange={(e) => setParam('group', e.target.value)} aria-label="Filter by who">
          <option value="">Everyone</option>
          {Object.entries(TASK_GROUP_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!tasks && !error && <Spinner />}
      {tasks && !list.length && <Empty icon="check">No tasks here.</Empty>}

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Task</th><th>Assigned to</th><th>Where</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={t.is_overdue ? 'row-overdue' : ''}>
                  <td>
                    <button className="cell-title" onClick={() => setViewing(t.id)}>{t.title}</button>
                    <div className="badges">
                      <Badge tone="blue">{t.category}</Badge>
                      {repeatLabel(t) && <Badge>{repeatLabel(t)}</Badge>}
                      {t.requires_verification && <Badge tone="amber">Sign-off</Badge>}
                      {t.priority === 'high' && <Badge tone="red">High</Badge>}
                      {t.comment_count > 0 && <Badge>{t.comment_count} comment{t.comment_count > 1 ? 's' : ''}</Badge>}
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
