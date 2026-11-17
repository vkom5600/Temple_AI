import { useEffect, useState } from 'react'
import { tasksApi, usersApi } from '../../api/endpoints'
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

  const [todayLoad, setTodayLoad] = useState<Record<number, number>>({})
  const [mode, setMode] = useState<'person' | 'role'>(initial.assigned_to ? 'person' : 'role')

  useEffect(() => {
    usersApi.list().then((r) => setPeople(r.users.filter((u) => u.is_active && u.approval_status === 'approved'))).catch(() => {})
    tasksApi.list({ view: 'today' }).then((r) => {
      const load: Record<number, number> = {}
      r.tasks.filter((t) => t.status === 'todo' && t.assigned_to).forEach((t) => { load[t.assigned_to!] = (load[t.assigned_to!] ?? 0) + 1 })
      setTodayLoad(load)
    }).catch(() => {})
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

  const workers = people.filter((p) => p.role === 'staff' || p.role === 'volunteer')
  const first = fromKey(assignees[0] ?? 'group:priest')
  const chosen = first.assigned_to ? people.find((p) => p.id === first.assigned_to) : undefined
  // Rule-based suggestion until the AI assistant: who else with the same job has fewer tasks today.
  const suggestion = (() => {
    if (!chosen) return null
    const mine = todayLoad[chosen.id] ?? 0
    if (mine < 2) return null
    const lighter = workers
      .filter((p) => p.id !== chosen.id && p.designation && p.designation === chosen.designation)
      .sort((a, b) => (todayLoad[a.id] ?? 0) - (todayLoad[b.id] ?? 0))[0]
    return `${chosen.full_name.split(' ')[0]} has ${mine} other tasks today.${lighter && (todayLoad[lighter.id] ?? 0) < mine ? ` ${lighter.full_name.split(' ')[0]} has ${todayLoad[lighter.id] ?? 0}.` : ''}`
  })()
  const groupPeople = first.assigned_group
    ? workers.filter((p) => p.designation === first.assigned_group || p.role === first.assigned_group || (first.assigned_group === 'staff' && p.role === 'staff'))
    : []
  const notifyLabel = (() => {
    if (allowMany && assignees.length > 1) return `Create ${assignees.length} tasks`
    if (title !== 'New task') return submitLabel
    if (chosen) return `Create & notify ${chosen.full_name.split(' ')[0]}`
    if (first.assigned_group) return `Create & notify ${TASK_GROUP_LABELS[first.assigned_group].toLowerCase()}${first.assigned_group === 'staff' || first.assigned_group.endsWith('s') ? '' : 's'}`
    return submitLabel
  })()

  const combinedSelect = (value: AssigneeKey, onChange: (key: AssigneeKey) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <optgroup label="A role (everyone in it)">
        {Object.entries(TASK_GROUP_LABELS).map(([id, l]) => <option key={id} value={`group:${id}`}>{l}</option>)}
      </optgroup>
      <optgroup label="A person">
        {people.map((p) => <option key={p.id} value={`user:${p.id}`}>{p.full_name} · {jobLabel(p)}</option>)}
      </optgroup>
    </select>
  )

  const setMain = (key: AssigneeKey) => setAssignees((list) => [key, ...list.slice(1)])
  const switchMode = (m: 'person' | 'role') => {
    setMode(m)
    if (m === 'person') setMain(`user:${(chosen ?? workers[0])?.id ?? people[0]?.id}`)
    else setMain(`group:${chosen?.designation ?? 'priest'}`)
  }

  return (
    <Modal
      title={title}
      subtitle={title === 'New task' ? 'Assign a job to staff or volunteers' : undefined}
      size="wide"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!canSave} onClick={submit}>
            <Icon name="send" size={16} /> {busy ? 'Saving…' : notifyLabel}
          </button>
        </>
      }
    >
      {showTemplates && (
        <div className="field">
          <span className="ulabel">Start from a template</span>
          <div className="chips">
            {TASK_TEMPLATES.map((t) => <button key={t.title} type="button" className="chip" onClick={() => { applyTemplate(t); setMode('role') }}>{t.title}</button>)}
          </div>
        </div>
      )}

      <div className="cols-2">
        <div className="col">
          <span className="ulabel">The essentials</span>
          <label className="field">
            <span className="label">What needs doing?</span>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Clean Main Hall before the puja" maxLength={200} autoFocus />
          </label>
          <label className="field">
            <span className="label">Details <span className="muted">(optional)</span></span>
            <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Specific notes, setup instructions…" maxLength={2000} />
          </label>
          <div className="field">
            <span className="label">Assign to</span>
            <div className="segmented" role="tablist">
              <button type="button" className={mode === 'person' ? 'on' : ''} onClick={() => switchMode('person')}>A person</button>
              <button type="button" className={mode === 'role' ? 'on' : ''} onClick={() => switchMode('role')}>A role</button>
            </div>
            {mode === 'person' ? (
              <select value={assignees[0]} onChange={(e) => setMain(e.target.value)} aria-label="Person">
                {people.map((p) => <option key={p.id} value={`user:${p.id}`}>{p.full_name} · {jobLabel(p)}</option>)}
                {initial.assigned_to && !people.some((p) => p.id === initial.assigned_to) && (
                  <option value={`user:${initial.assigned_to}`}>{initial.assigned_to_name ?? 'Current person'}</option>
                )}
              </select>
            ) : (
              <select value={assignees[0]} onChange={(e) => setMain(e.target.value)} aria-label="Role">
                {Object.entries(TASK_GROUP_LABELS).map(([id, l]) => <option key={id} value={`group:${id}`}>{l}</option>)}
              </select>
            )}
            {mode === 'role' ? (
              <span className="muted small">
                <Icon name="users" size={14} /> Goes to everyone in that role; the first to tick it off completes it.
                {groupPeople.length > 0 && <> Will be sent to <b>{groupPeople.length}</b>: {groupPeople.map((p) => p.full_name.split(' ')[0]).join(', ')}</>}
              </span>
            ) : (
              <span className="muted small">Choosing a role sends it to everyone in that role instead.</span>
            )}
            {allowMany && assignees.slice(1).map((key, i) => (
              <div key={i} className="row assignee-row">
                {combinedSelect(key, (k) => setAssignees((list) => list.map((x, j) => (j === i + 1 ? k : x))), `Also for ${i + 1}`)}
                <button type="button" className="icon-btn" aria-label={`Remove ${labelOf(key)}`} onClick={() => setAssignees((list) => list.filter((_, j) => j !== i + 1))}>
                  <Icon name="x" />
                </button>
              </div>
            ))}
            {allowMany && (
              <button type="button" className="link-btn small" onClick={() => setAssignees((list) => [...list, 'group:cleaner'])}>
                <Icon name="plus" size={14} /> Also give it to someone else (a separate task each)
              </button>
            )}
          </div>
          {suggestion && (
            <div className="suggest-box"><span className="star">✦</span><span><b>Suggestion:</b> {suggestion}</span></div>
          )}
        </div>

        <div className="col">
          <span className="ulabel">Options</span>
          <div className="field">
            <span className="label">Deadline</span>
            <div className="grid-2f">
              <label className="with-ic"><Icon name="calendar" /><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} aria-label="Date" /></label>
              <label className="with-ic"><Icon name="clock" /><input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} aria-label="Time" /></label>
            </div>
          </div>
          <div className="field">
            <span className="label">Repeat</span>
            <div className="segmented">
              {(['none', 'daily', 'weekly'] as Recurrence[]).map((r) => (
                <button key={r} type="button" className={form.recurrence === r ? 'on' : ''} onClick={() => set('recurrence', r)}>
                  {r === 'none' ? 'None' : r === 'daily' ? 'Daily' : 'Weekly'}
                </button>
              ))}
            </div>
            {initial.recurrence && initial.recurrence !== 'none' && form.recurrence === 'none' && (
              <span className="muted small">"None" stops this task repeating from now on.</span>
            )}
          </div>
          <div className="field">
            <span className="label">Priority</span>
            <div className="segmented">
              {(form.priority === 'low' ? (['low', 'normal', 'high'] as Priority[]) : (['normal', 'high'] as Priority[])).map((p) => (
                <button key={p} type="button" className={form.priority === p ? 'on' : ''} onClick={() => set('priority', p)}>{PRIORITY_LABELS[p]}</button>
              ))}
            </div>
          </div>
          <label className="checkline">
            <input type="checkbox" checked={form.requires_verification} onChange={(e) => set('requires_verification', e.target.checked)} />
            <span><b>Safety task</b><span>Needs a second person to check &amp; sign off</span></span>
          </label>
          <div className="grid-2f">
            <label className="field">
              <span className="label">Where</span>
              <select value={form.area} onChange={(e) => set('area', e.target.value)}>
                {[...new Set([...AREAS, form.area])].filter(Boolean).map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          {category === 'Other' && (
            <label className="field">
              <span className="label">Name the category</span>
              <input value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} placeholder="e.g. Garden, Library" maxLength={50} />
            </label>
          )}
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
