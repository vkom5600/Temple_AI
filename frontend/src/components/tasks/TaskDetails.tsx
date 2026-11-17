import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { PRIORITY_LABELS } from '../../constants'
import { fmtTime, fmtWhen } from '../../lib/format'
import { assigneeLabel, repeatLabel } from '../../lib/tasks'
import { useToast } from '../Toast'
import { Avatar, ErrorNote, Icon, Modal, Spinner } from '../ui'
import TaskForm from './TaskForm'
import type { Task, TaskComment } from '../../types'

// T4 Task details and T5 Review a finished task (designs: screens/19_T4, 20_T5):
// a side panel with the brief, the submission, the history, and the admin actions.
const STATUS: Record<Task['status'], { label: string; cls: string }> = {
  todo: { label: 'To do', cls: 'pill-soft' },
  awaiting_signoff: { label: 'Awaiting review', cls: 'pill-saf' },
  done: { label: 'Done', cls: 'pill-grn' },
  flagged: { label: "Couldn't do", cls: 'pill-red' },
  cancelled: { label: 'Cancelled', cls: 'pill-soft' },
}

interface Event { at: string; title: string; detail?: string; tone: '' | 'ev-blue' | 'ev-green' | 'ev-red' }

function history(task: Task, comments: TaskComment[]): Event[] {
  const events: Event[] = [
    { at: task.created_at, title: task.created_by_name ? `Assigned by ${task.created_by_name}` : 'Created by the daily routine', detail: assigneeLabel(task), tone: '' },
  ]
  for (const c of comments) {
    const who = c.user_name ?? 'Temple AI'
    if (c.comment_type === 'sent_back') events.push({ at: c.created_at, title: `Sent back by ${who}`, detail: c.comment, tone: 'ev-red' })
    else if (c.comment_type === 'flagged') events.push({ at: c.created_at, title: `${who} couldn't do it`, detail: c.comment, tone: 'ev-red' })
    else if (c.comment_type === 'system') events.push({ at: c.created_at, title: c.comment, tone: '' })
    else events.push({ at: c.created_at, title: `Comment from ${who}`, detail: c.comment, tone: 'ev-blue' })
  }
  if (task.last_reminded_at) events.push({ at: task.last_reminded_at, title: `Reminder sent${task.reminder_count > 1 ? ` (${task.reminder_count} so far)` : ''}`, tone: '' })
  if (task.completed_at) events.push({ at: task.completed_at, title: `Done by ${task.completed_by_name ?? 'someone'}`, detail: task.requires_verification ? 'Submitted for a second check' : undefined, tone: 'ev-green' })
  if (task.verified_at) events.push({ at: task.verified_at, title: `Signed off by ${task.verified_by_name}`, tone: 'ev-green' })
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export default function TaskDetails({ taskId, onClose, onChanged }: { taskId: number; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [fixNote, setFixNote] = useState('')
  const [comment, setComment] = useState('')

  const load = useCallback(() => {
    tasksApi.get(taskId).then((r) => { setTask(r.task); setComments(r.comments) }).catch((e: Error) => setError(e.message))
  }, [taskId])

  useEffect(load, [load])

  const run = async (action: () => Promise<{ message: string }>, close = false) => {
    setError('')
    setBusy(true)
    try {
      const r = await action()
      toast(r.message)
      onChanged()
      if (close) onClose()
      else load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setConfirmCancel(false)
    }
  }

  if (editing && task) {
    return (
      <TaskForm
        title="Edit task"
        initial={task}
        submitLabel="Save changes"
        onClose={() => setEditing(false)}
        onSubmit={async ([input]) => {
          const r = await tasksApi.update(task.id, input)
          toast(r.message)
          onChanged()
          setEditing(false)
          load()
        }}
      />
    )
  }

  const status = task ? (task.is_overdue ? { label: 'Overdue', cls: 'pill-red' } : STATUS[task.status]) : null
  const review = task?.status === 'awaiting_signoff'
  const ownWork = task?.completed_by === user?.id
  const open = task && ['todo', 'flagged'].includes(task.status)
  const onTime = task?.completed_at && (!task.due_at || new Date(task.completed_at) <= new Date(task.due_at))
  const note = task && comments.find((c) => c.comment_type === 'comment' && c.user_id === task.completed_by)

  const footer = task && (
    review && !ownWork ? (
      <>
        <button className="btn btn-red-outline" disabled={!fixNote.trim() || busy} onClick={() => run(() => tasksApi.sendBack(task.id, fixNote.trim()), true)}>
          <Icon name="undo" size={16} /> Send back with note
        </button>
        <button className="btn btn-green grow btn-lg" disabled={busy} onClick={() => run(() => tasksApi.verify(task.id), true)}>
          <Icon name="check-circle" /> Approve work
        </button>
      </>
    ) : (
      <>
        {task.status !== 'cancelled' && !confirmCancel && (
          <button className="btn-text-red push-left" disabled={busy} onClick={() => setConfirmCancel(true)}>Delete task</button>
        )}
        {confirmCancel && (
          <span className="row push-left">
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => tasksApi.cancel(task.id), true)}>
              {task.recurrence !== 'none' ? 'Just this one' : 'Yes, delete it'}
            </button>
            {task.recurrence !== 'none' && (
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => tasksApi.cancel(task.id, true), true)}>And stop repeating</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>Keep</button>
          </span>
        )}
        {(task.status === 'done' || task.status === 'cancelled') && (
          <button className="btn btn-outline" disabled={busy} onClick={() => run(() => tasksApi.reopen(task.id))}>Reopen</button>
        )}
        {open && <button className="btn btn-outline" disabled={busy} onClick={() => run(() => tasksApi.remind(task.id))}>Send reminder</button>}
        {task.status !== 'cancelled' && <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit task</button>}
      </>
    )
  )

  return (
    <Modal
      title="Task details"
      size="drawer"
      onClose={onClose}
      head={
        <div className="drawer-head">
          {status && <span className={`pill ${status.cls}`}><span className="dot" /> {status.label}</span>}
          {task && <span className="muted">Task #T-{task.id}</span>}
          {task && task.status !== 'cancelled' && review && (
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      }
      footer={footer}
    >
      {!task && !error && <Spinner />}
      {task && (
        <>
          <div className="drawer-title">
            <h2>{task.title}</h2>
            {repeatLabel(task) && <span className="tag tag-saf">{repeatLabel(task)}</span>}
          </div>

          <section className="dsec">
            <div className="dsec-head"><span>Task brief &amp; assignment</span><small>Created {fmtWhen(task.created_at)}</small></div>
            {task.description && (
              <div className="quote">
                <b><Icon name="message" size={16} /> Instructions from {task.created_by_name ?? 'the committee'}:</b>
                <p>“{task.description}”</p>
              </div>
            )}
            <div className="info-grid">
              <div className="info"><small>Assigned to</small><b>{task.assigned_to_name ? <Avatar name={task.assigned_to_name} size={24} /> : <Icon name="users" size={16} />} {assigneeLabel(task)}</b></div>
              <div className="info"><small>Assigned by</small><b>{task.created_by_name ? <><Avatar name={task.created_by_name} size={24} /> {task.created_by_name}</> : 'Daily routine'}</b></div>
              <div className="info"><small>Deadline</small><b className={task.is_overdue ? 'red' : ''}>{fmtWhen(task.due_at)}</b></div>
              <div className="info"><small>Repeats</small><b>{repeatLabel(task) ?? 'One time'}</b></div>
              <div className="info"><small>Where</small><b>{task.area || '—'}</b></div>
              <div className="info"><small>Category</small><b>{task.category}</b></div>
              <div className="info"><small>Priority</small><b>{PRIORITY_LABELS[task.priority]}</b></div>
              <div className="info"><small>Safety task</small><b>{task.requires_verification ? 'Yes · needs a second check' : 'Off'}</b></div>
            </div>
          </section>

          {task.completed_at && (
            <section className="dsec">
              <div className="dsec-head">
                <span>Submission</span>
                <span className={`pill ${onTime ? 'pill-grn' : 'pill-red'}`}><Icon name="check" size={14} /> Done {fmtTime(task.completed_at)} ({onTime ? 'on time' : 'late'})</span>
              </div>
              {note ? (
                <div className="quote">
                  <b><Icon name="message" size={16} /> {task.completed_by_name}'s note:</b>
                  <p>“{note.comment}”</p>
                </div>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>{task.completed_by_name} marked it done without a note.</p>
              )}
              {task.verified_by_name && <p className="small" style={{ margin: 0, color: 'var(--green)' }}><Icon name="check-circle" size={14} /> Signed off by {task.verified_by_name}, {fmtWhen(task.verified_at!)}</p>}
            </section>
          )}

          <section className="dsec">
            <div className="dsec-head"><span>Task history</span></div>
            <ul className="timeline">
              {history(task, comments).map((e, i) => (
                <li key={i} className={e.tone}>
                  <div className="grow"><b>{e.title}</b>{e.detail && <span>{e.detail}</span>}</div>
                  <time>{fmtTime(e.at)}</time>
                </li>
              ))}
            </ul>
            <form
              className="row comment-form"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => { const r = await tasksApi.comment(task.id, comment); setComment(''); return r })
              }}
            >
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" maxLength={1000} aria-label="Add a comment" />
              <button className="btn btn-outline btn-sm" disabled={!comment.trim() || busy}>Add</button>
            </form>
          </section>

          {review && !ownWork && (
            <label className="dsec">
              <span className="dsec-head"><span>What needs fixing? <small>(optional note if sending back)</small></span></span>
              <input value={fixNote} onChange={(e) => setFixNote(e.target.value)} placeholder="e.g. Please re-check the back door" maxLength={1000} />
            </label>
          )}
          {review && ownWork && <p className="muted small">You marked this done, so someone else needs to check it.</p>}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
