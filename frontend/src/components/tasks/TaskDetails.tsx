import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { PRIORITY_LABELS } from '../../constants'
import { fmtWhen, timeAgo } from '../../lib/format'
import { assigneeLabel, repeatLabel } from '../../lib/tasks'
import { useToast } from '../Toast'
import { ErrorNote, Modal, Spinner } from '../ui'
import StatusBadge from './StatusBadge'
import TaskForm from './TaskForm'
import type { Task, TaskComment } from '../../types'

const COMMENT_PREFIX: Record<TaskComment['comment_type'], string> = {
  comment: '',
  sent_back: 'Sent back: ',
  flagged: "Couldn't do: ",
  system: '',
}

// Admin view of one task: details, history, and every admin action.
export default function TaskDetails({ taskId, onClose, onChanged }: { taskId: number; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [sendBack, setSendBack] = useState<string | null>(null)
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
      setSendBack(null)
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

  const open = task && ['todo', 'flagged'].includes(task.status)
  const ownWork = task?.completed_by === user?.id

  return (
    <Modal
      title="Task details"
      onClose={onClose}
      footer={
        task && (
          <>
            {task.status !== 'cancelled' && !confirmCancel && (
              <button className="btn btn-danger-ghost push-left" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel task</button>
            )}
            {confirmCancel && (
              <span className="row push-left">
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => tasksApi.cancel(task.id))}>
                  {task.recurrence !== 'none' ? 'Cancel this one' : 'Yes, cancel it'}
                </button>
                {task.recurrence !== 'none' && (
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => tasksApi.cancel(task.id, true))}>Cancel and stop repeating</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>Keep</button>
              </span>
            )}
            {task.status !== 'todo' && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => tasksApi.reopen(task.id))}>Reopen</button>
            )}
            {open && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => tasksApi.remind(task.id))}>Send reminder</button>
            )}
            {task.status !== 'cancelled' && <button className="btn btn-outline" onClick={() => setEditing(true)}>Edit / reassign</button>}
          </>
        )
      }
    >
      {!task && !error && <Spinner />}
      {task && (
        <>
          <h3 className="detail-title">{task.title}</h3>
          <dl className="details">
            <dt>Status</dt><dd><StatusBadge task={task} /></dd>
            <dt>Assigned to</dt><dd>{assigneeLabel(task)}</dd>
            <dt>Due</dt><dd>{fmtWhen(task.due_at)}{repeatLabel(task) && <span className="muted"> · {repeatLabel(task)}</span>}</dd>
            <dt>Where</dt><dd>{task.area ?? '—'}</dd>
            <dt>Category</dt><dd>{task.category}</dd>
            <dt>Priority</dt><dd>{PRIORITY_LABELS[task.priority]}{task.requires_verification && ' · needs sign-off'}</dd>
            {task.description && <><dt>Notes</dt><dd>{task.description}</dd></>}
            {task.completed_by_name && <><dt>Done by</dt><dd>{task.completed_by_name}, {fmtWhen(task.completed_at!)}</dd></>}
            {task.verified_by_name && <><dt>Signed off by</dt><dd>{task.verified_by_name}, {fmtWhen(task.verified_at!)}</dd></>}
            {task.reminder_count > 0 && <><dt>Reminders</dt><dd>{task.reminder_count} sent, last {timeAgo(task.last_reminded_at!)}</dd></>}
            <dt>Created by</dt><dd>{task.created_by_name ?? 'Repeating task'}</dd>
          </dl>

          {task.status === 'awaiting_signoff' && (
            <div className="panel-attn signoff-box">
              {ownWork ? (
                <p className="muted small">You marked this done, so someone else needs to sign it off.</p>
              ) : sendBack === null ? (
                <div className="row">
                  <span className="grow small">Done by {task.completed_by_name}. Checked it?</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSendBack('')}>Not done</button>
                  <button className="btn btn-success btn-sm" disabled={busy} onClick={() => run(() => tasksApi.verify(task.id))}>I checked, sign off</button>
                </div>
              ) : (
                <div className="stack-tight">
                  <input autoFocus value={sendBack} onChange={(e) => setSendBack(e.target.value)} placeholder="What's wrong? e.g. back door still open" />
                  <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setSendBack(null)}>Cancel</button>
                    <button className="btn btn-danger btn-sm" disabled={!sendBack.trim() || busy} onClick={() => run(() => tasksApi.sendBack(task.id, sendBack))}>Send back</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <h4>History and comments</h4>
          {comments.length === 0 && <p className="muted small">No comments yet.</p>}
          <ul className="comments">
            {comments.map((c) => (
              <li key={c.id} className={c.comment_type !== 'comment' ? `comment-${c.comment_type}` : ''}>
                <b>{c.user_name ?? 'System'}:</b> {COMMENT_PREFIX[c.comment_type]}{c.comment} <span className="muted small">· {timeAgo(c.created_at)}</span>
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
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
