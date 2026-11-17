import { useEffect, useState } from 'react'
import { usersApi } from '../../api/endpoints'
import { AREAS, CATEGORIES, PRIORITY_LABELS, TASK_GROUP_LABELS, TASK_TEMPLATES, jobLabel } from '../../constants'
import { toDateInput, toTimeInput } from '../../lib/format'
import { ErrorNote, Icon, Modal } from '../ui'
import type { Priority, Recurrence, Task, TaskGroup, TaskInput, User } from '../../types'

// An assignee is encoded as "group:cleaner" or "user:12" in the <select>.
type AssigneeKey = string
const keyOf = (t: Pick<TaskInput, 'assigned_to' | 'assigned_group'>): AssigneeKey =>
  t.assigned_group ? `group:${t.assigned_group}` : `user:${t.assigned_to}`
const fromKey = (key: AssigneeKey): Pick<TaskInput, 'assigned_to' | 'assigned_group'> => {
  const [type, value] = key.split(':')
  return type === 'group' ? { assigned_group: value as TaskGroup, assigned_to: null } : { assigned_to: Number(value), assigned_group: null }
}

interface Props {
  title?: string
  initial?: Partial<Task>
  showTemplates?: boolean
  allowMany?: boolean // New task: pick several assignees -> one task each
  submitLabel?: string
  onClose: () => void
  onSubmit: (tasks: TaskInput[]) => Promise<void>
}

// Admin form for creating / editing a task (also used to turn an issue into a task).
export default function TaskForm({ title = 'New task', initial = {}, showTemplates, allowMany, submitLabel = 'Assign task', onClose, onSubmit }: Props) {
  const due = initial.due_at ? new Date(initial.due_at) : (() => { const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0); return d })()
  const knownCategory = (c?: string) => !!c && CATEGORIES.includes(c) && c !== 'Other'

  const [people, setPeople] = useState<User[]>([])
  const [form, setForm] = useState({
    title: initial.title ?? '',
    description: initial.description ?? '',
    area: initial.area ?? AREAS[0],
    priority: (initial.priority ?? 'normal') as Priority,
    requires_verification: initial.requires_verification ?? false,
    recurrence: (initial.recurrence ?? 'none') as Recurrence,
    date: toDateInput(due),
    time: toTimeInput(due),
  })
  const [category, setCategory] = useState(knownCategory(initial.category) ? initial.category! : initial.category ? 'Other' : 'General')
  const [otherCategory, setOtherCategory] = useState(knownCategory(initial.category) ? '' : initial.category ?? '')
  const [assignees, setAssignees] = useState<AssigneeKey[]>(
    initial.assigned_group || initial.assigned_to ? [keyOf({ assigned_group: initial.assigned_group ?? null, assigned_to: initial.assigned_to ?? null })] : ['group:priest'],
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    usersApi.list().then((r) => setPeople(r.users.filter((u) => u.is_active && u.approval_status === 'approved'))).catch(() => {})
  }, [])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const applyTemplate = (t: (typeof TASK_TEMPLATES)[number]) => {
    setForm((f) => ({ ...f, title: t.title, area: t.area, requires_verification: t.safety, recurrence: t.recurrence, priority: t.priority }))
    setCategory(t.category)
    setAssignees([`group:${t.group}`])
  }

  const labelOf = (key: AssigneeKey) => {
    const a = fromKey(key)
    if (a.assigned_group) return TASK_GROUP_LABELS[a.assigned_group]
    return people.find((p) => p.id === a.assigned_to)?.full_name ?? initial.assigned_to_name ?? 'Someone'
  }

  const finalCategory = category === 'Other' ? otherCategory.trim() : category
  const canSave = form.title.trim() && assignees.length > 0 && finalCategory && form.date && form.time && !busy

  const submit = async () => {
    setError('')
    setBusy(true)
    const base = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: finalCategory,
      area: form.area,
      priority: form.priority,
      requires_verification: form.requires_verification,
      recurrence: form.recurrence,
      due_at: new Date(`${form.date}T${form.time}`).toISOString(),
    }
    try {
      await onSubmit(assignees.map((key) => ({ ...base, ...fromKey(key) })))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const assigneeSelect = (value: AssigneeKey, onChange: (key: AssigneeKey) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <optgroup label="A group (one shared task, anyone in it can do it)">
        {Object.entries(TASK_GROUP_LABELS).map(([id, l]) => <option key={id} value={`group:${id}`}>{l}</option>)}
      </optgroup>
      <optgroup label="A specific person">
        {people.map((p) => <option key={p.id} value={`user:${p.id}`}>{p.full_name} ({jobLabel(p)})</option>)}
        {initial.assigned_to && !people.some((p) => p.id === initial.assigned_to) && (
          <option value={`user:${initial.assigned_to}`}>{initial.assigned_to_name ?? 'Current person'}</option>
        )}
      </optgroup>
    </select>
  )

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={submit}>
            {busy ? 'Saving…' : allowMany && assignees.length > 1 ? `Assign ${assignees.length} tasks` : submitLabel}
          </button>
        </>
      }
    >
      {showTemplates && (
        <div className="field">
          <span className="label">Start from a template</span>
          <div className="chips">
            {TASK_TEMPLATES.map((t) => <button key={t.title} type="button" className="chip" onClick={() => applyTemplate(t)}>{t.title}</button>)}
          </div>
        </div>
      )}

      <label className="field">
        <span className="label">Task</span>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Clean the kitchen floor" maxLength={200} autoFocus />
      </label>

      <div className="field">
        <span className="label">Assign to</span>
        {allowMany ? (
          <>
            {assignees.map((key, i) => (
              <div key={i} className="row assignee-row">
                {assigneeSelect(key, (k) => setAssignees((list) => list.map((x, j) => (j === i ? k : x))), `Assignee ${i + 1}`)}
                {assignees.length > 1 && (
                  <button type="button" className="icon-btn" aria-label={`Remove ${labelOf(key)}`} onClick={() => setAssignees((list) => list.filter((_, j) => j !== i))}>
                    <Icon name="x" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="link-btn small" onClick={() => setAssignees((list) => [...list, 'group:cleaner'])}>
              <Icon name="plus" size={14} /> Also give it to someone else (creates a separate task each)
            </button>
          </>
        ) : (
          assigneeSelect(assignees[0], (k) => setAssignees([k]), 'Assign to')
        )}
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="label">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {category === 'Other' && (
          <label className="field">
            <span className="label">Name the category</span>
            <input value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} placeholder="e.g. Garden, Library" maxLength={50} />
          </label>
        )}
        <label className="field">
          <span className="label">Where</span>
          <select value={form.area} onChange={(e) => set('area', e.target.value)}>
            {[...new Set([...AREAS, form.area])].map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Date</span>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Time</span>
          <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Repeats</span>
          <select value={form.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
            <option value="none">One time only</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Priority</span>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
            {Object.entries(PRIORITY_LABELS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
      </div>

      {initial.recurrence && initial.recurrence !== 'none' && form.recurrence === 'none' && (
        <p className="muted small">"One time only" stops this task repeating from now on.</p>
      )}

      <label className="toggle">
        <input type="checkbox" checked={form.requires_verification} onChange={(e) => set('requires_verification', e.target.checked)} />
        <span>
          <b>Needs a second person to sign off</b>
          <span className="muted small"> For safety tasks like locking up or gas off. It only closes after a volunteer or committee member checks it.</span>
        </span>
      </label>

      <label className="field">
        <span className="label">Notes <span className="muted">(optional)</span></span>
        <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
      </label>

      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
