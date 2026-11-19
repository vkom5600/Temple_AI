import { useCallback, useEffect, useState } from 'react'
import { issuesApi, tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { PRIORITY_LABELS } from '../../constants'
import { fmtTime, fmtWhen } from '../../lib/format'
import { assigneeLabel, repeatLabel } from '../../lib/tasks'
import { useToast } from '../Toast'
import { Avatar, ErrorNote, Icon, Modal, Spinner } from '../ui'
import TaskForm from './TaskForm'
import ConvertIssueForm from './ConvertIssueForm'
import type { Issue, Task, TaskComment, TaskInput } from '../../types'
import RemindButton from './RemindButton'
import { ukAddDays, ukDate, ukParts } from '../../lib/uk'

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
  // T6: the open problem this task was flagged with, a reply, and the fix-task form
  const [issue, setIssue] = useState<Issue | null>(null)
  const [reply, setReply] = useState('')
  const [fixing, setFixing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(() => {
    tasksApi.get(taskId).then((r) => {
      setTask(r.task)
      setComments(r.comments)
      if (r.task.status === 'flagged') issuesApi.list('open').then((x) => setIssue(x.issues.find((i) => i.task_id === r.task.id) ?? null)).catch(() => {})
    }).catch((e: Error) => setError(e.message))
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
          if (task.status === 'flagged' && issue) await issuesApi.resolve(issue.id, 'Reassigned')
          toast(r.message)
          onChanged()
          setEditing(false)
          load()
        }}
      />
    )
  }

  // The task as a TaskInput, for "Extend deadline" (same task, due a day later)
  const inputOf = (t: Task, due: string | null): TaskInput => ({
    title: t.title, description: t.description ?? '', category: t.category, area: t.area ?? '',
    assigned_to: t.assigned_to, assigned_group: t.assigned_group, priority: t.priority,
    requires_verification: t.requires_verification, due_at: due, recurrence: t.recurrence,
  })
  const extend = () => run(async () => {
    if (!task) return { message: '' }
    let base = task.due_at ? new Date(task.due_at) : new Date()
    // overdue: move it to the same UK time today, then a day on
    if (base.getTime() < Date.now()) { const n = ukParts(); const b = ukParts(base); base = ukDate(n.y, n.m, n.d, b.h, b.min) }
    base = ukAddDays(base, 1)
    if (issue) await issuesApi.resolve(issue.id, `Moved to ${fmtWhen(base.toISOString())}`)
    await tasksApi.update(task.id, inputOf(task, base.toISOString()))
    return { message: `Moved to ${fmtWhen(base.toISOString())}` }
  })
  const flaggedNote = comments.filter((c) => c.comment_type === 'flagged').slice(-1)[0]

  const status = task ? (task.is_overdue ? { label: 'Overdue', cls: 'pill-red' } : STATUS[task.status]) : null
  const review = task?.status === 'awaiting_signoff'
  const ownWork = task?.completed_by === user?.id
  const open = task && ['todo', 'flagged'].includes(task.status)
  const onTime = task?.completed_at && (!task.due_at || new Date(task.completed_at) <= new Date(task.due_at))
  const note = task && comments.find((c) => c.comment_type === 'comment' && c.user_id === task.completed_by)

  // T6 has no footer (its actions are in the panel), except to confirm a cancel.
  const footer = task && !(task.status === 'flagged' && !confirmCancel) && (
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
        {open && <RemindButton task={task} act={(a) => run(a)} />}
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

          {task.status === 'flagged' && (
            <>
              <div className="quote flagged-box">
                <b><Icon name="flag" size={16} /> {flaggedNote?.user_name ?? 'Someone'} flagged a problem{flaggedNote && ` · ${fmtTime(flaggedNote.created_at)}`}</b>
                <p>“{flaggedNote?.comment ?? task.last_comment}”</p>
              </div>
              <div className="suggest-box flag-suggest">
                <span className="star">✦</span>
                <div className="grow">
                  <b>Suggestion</b>
                  <ul>
                    {/broken|fix|repair/i.test(issue?.category ?? flaggedNote?.comment ?? '') ? (
                      <><li>Create a fix task for maintenance first</li><li>Then move this task to tomorrow</li></>
                    ) : /time/i.test(issue?.category ?? flaggedNote?.comment ?? '') ? (
                      <><li>Move this task to tomorrow, same time</li><li>Or give it to someone else with the same job</li></>
                    ) : /supplies|find/i.test(issue?.category ?? flaggedNote?.comment ?? '') ? (
                      <><li>Get the supplies (or ask a volunteer to)</li><li>Then move this task to tomorrow</li></>
                    ) : (
                      <><li>Give it to someone else, or to the whole job group</li><li>Let them know by replying below</li></>
                    )}
                  </ul>
                </div>
              </div>
              <label className="dsec">
                <span className="dsec-head"><span>Reply to {flaggedNote?.user_name?.split(' ')[0] ?? 'them'}</span></span>
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder={`Type a message to ${flaggedNote?.user_name?.split(' ')[0] ?? 'them'}…`} />
                  <button type="button" className="btn btn-primary" disabled={!reply.trim() || busy} onClick={() => run(async () => { await tasksApi.comment(task.id, reply.trim()); setReply(''); return { message: `Sent to ${flaggedNote?.user_name?.split(' ')[0] ?? 'them'}'s phone` } })}>Send</button>
                </span>
                <span className="muted small">Goes to their phone.</span>
              </label>
              <div className="dsec">
                <span className="dsec-head"><span>Or choose yourself</span></span>
                <div className="choose-3">
                  <button className="choose" disabled={!issue} onClick={() => setFixing(true)}><Icon name="plus" size={20} /> Create fix task</button>
                  <button className="choose" disabled={busy} onClick={extend}><Icon name="clock" size={20} /> Extend deadline</button>
                  <button className="choose" onClick={() => setEditing(true)}><Icon name="user" size={20} /> Reassign</button>
                </div>
                <button className="btn-text-red" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmCancel(true)}><Icon name="x" size={14} /> Cancel this task</button>
              </div>
              <button className="done-toggle" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>Details &amp; history <Icon name="chevron-down" size={16} /></button>
            </>
          )}

          {(task.status !== 'flagged' || showHistory) && <>
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

          </>}

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
      {fixing && issue && <ConvertIssueForm issue={issue} onClose={() => setFixing(false)} onDone={(m) => { toast(m); setFixing(false); onChanged(); onClose() }} />}
    </Modal>
  )
}
