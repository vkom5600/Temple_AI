import { Link } from 'react-router-dom'
import { bookingsApi, issuesApi, tasksApi } from '../api/endpoints'
import { ROLE_LABELS } from '../constants'
import { fmtTime, timeAgo } from '../lib/format'
import { bookingSlot } from '../lib/bookings'
import { jobName, quickTaskFor, type InboxItem } from '../lib/inbox'
import { assigneeLabel } from '../lib/tasks'
import { Icon, rowClick } from './ui'
import type { Issue, Role } from '../types'
import RemindButton from './tasks/RemindButton'
import { useAuth } from '../auth/AuthContext'
import { can } from '../lib/access'
import QuestionRow from './QuestionRow'

type Action = () => Promise<{ message: string }>

// "2h", "45 min", "3 days"
export function lateBy(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''}`
}

// One row of "Needs your attention" (H1) or the Action Center (AC1).
// Buttons either work straight away (Remind, Assign, Sign off, Mark fixed) or open a page.
export default function InboxRow({ item, myId, showWhen, onOpenTask, onOpenBooking, onConvert, act }: {
  item: InboxItem
  myId: number
  showWhen?: boolean
  onOpenTask: (id: number) => void
  onOpenBooking: (id: number) => void
  onConvert: (issue: Issue) => void
  act: (action: Action) => void
}) {
  const { task, issue } = item
  const { user } = useAuth()
  // Committee members with View access see the row but not its buttons
  const canAct = (i: InboxItem) =>
    i.kind === 'booking' ? can(user, 'calendar', 'manage') : i.kind === 'signups' ? can(user, 'people', 'manage') : can(user, 'tasks', 'manage')

  if (item.kind === 'overdue' && task) {
    const mine = task.assigned_to === myId
    const days = Math.floor((Date.now() - new Date(task.due_at!).getTime()) / 86_400_000) // overdue tasks always have a time
    return (
      <div className="attn-row row-open" {...rowClick(() => onOpenTask(task.id))}>
        <span className="tile-ic ic-red"><Icon name={task.requires_verification ? 'shield' : 'alarm'} size={20} /></span>
        <div className="grow">
          <div className="attn-name"><button onClick={() => onOpenTask(task.id)}>{task.title}</button></div>
          <div className="attn-meta">
            {task.requires_verification && <span>Safety ·</span>}
            <span>{assigneeLabel(task)}</span>
            <span className="pill pill-red">Overdue {lateBy(task.due_at!)}</span>
          </div>
          {task.requires_verification ? (
            <span className="hint"><span className="star">✦</span> Safety task, so it goes first</span>
          ) : days >= 1 && !mine ? (
            <span className="hint hint-red"><span className="star">✦</span> Late {days} day{days > 1 ? 's' : ''}. Give it to someone else?</span>
          ) : task.last_reminded_at ? (
            <span className="hint hint-ind"><span className="star">✦</span> Reminded {task.reminder_count > 1 ? `${task.reminder_count} times, last ` : ''}{timeAgo(task.last_reminded_at)}</span>
          ) : null}
        </div>
        {showWhen && <span className="inbox-when">Due {fmtTime(task.due_at)}</span>}
        <div className="attn-actions" hidden={!canAct(item)}>
          {mine ? (
            <button className="btn btn-outline" onClick={() => act(() => tasksApi.complete(task.id))}><Icon name="check" size={16} /> Mark done</button>
          ) : (
            <RemindButton task={task} act={act} />
          )}
          <button className="btn btn-outline" onClick={() => onOpenTask(task.id)}>Reassign</button>
        </div>
      </div>
    )
  }

  if (item.kind === 'problem' && issue) {
    const helper = item.helper
    const first = helper?.full_name.split(' ')[0]
    const taskId = issue.task_id
    return (
      <div className={`attn-row ${taskId ? 'row-open' : ''}`} {...(taskId ? rowClick(() => onOpenTask(taskId)) : {})}>
        <span className="tile-ic ic-saf"><Icon name={/lock|door/i.test(issue.description) ? 'lock' : 'alert'} size={20} /></span>
        <div className="grow">
          <div className="attn-name">{issue.description}</div>
          <div className="attn-meta">
            <span>{issue.category} · reported by {issue.reported_by_name ?? 'someone'} · {timeAgo(issue.created_at)}</span>
            {issue.task_title && <span>· on "{issue.task_title}"</span>}
          </div>
          <span className="hint hint-ind"><span className="star">✦</span> Suggest {helper ? `${first} (${jobName(issue)})` : jobName(issue)}</span>
        </div>
        <div className="attn-actions" hidden={!canAct(item)}>
          {helper ? (
            <button className="btn btn-saf-outline" onClick={() => act(() => issuesApi.convert(issue.id, quickTaskFor(issue, helper)))}>Assign {first}</button>
          ) : (
            <button className="btn btn-saf-outline" onClick={() => onConvert(issue)}>Create task</button>
          )}
          <button className="btn btn-outline" onClick={() => act(() => issuesApi.resolve(issue.id, ''))}>Mark fixed</button>
        </div>
      </div>
    )
  }

  if (item.kind === 'signoff' && task) {
    const own = task.completed_by === myId
    return (
      <div className="attn-row row-open" {...rowClick(() => onOpenTask(task.id))}>
        <span className="tile-ic ic-grn"><Icon name="shield" size={20} /></span>
        <div className="grow">
          <div className="attn-name"><button onClick={() => onOpenTask(task.id)}>{task.title}</button></div>
          <div className="attn-meta">
            <span>Done by {task.completed_by_name ?? 'someone'}{task.completed_at && ` · ${timeAgo(task.completed_at)}`}</span>
          </div>
          <span className="hint hint-grn"><span className="star">✦</span> Safety task: needs a second person to check</span>
        </div>
        <div className="attn-actions" hidden={!canAct(item)}>
          <button className="btn btn-outline" onClick={() => onOpenTask(task.id)}>Review</button>
          {!own && <button className="btn btn-primary" onClick={() => act(() => tasksApi.verify(task.id))}>Sign off</button>}
        </div>
      </div>
    )
  }

  if (item.kind === 'booking' && item.booking) {
    const b = item.booking.booking
    const check = item.booking.check
    const ok = check?.recommendation === 'approve'
    return (
      <div className="attn-row row-open" {...rowClick(() => onOpenBooking(b.id))}>
        <span className="tile-ic ic-ind"><Icon name="calendar" size={20} /></span>
        <div className="grow">
          <div className="attn-name"><button onClick={() => onOpenBooking(b.id)}>{b.title}, {b.resource_name}</button></div>
          <div className="attn-meta">
            <span>{b.contact_name ?? b.requested_by_name} · {bookingSlot(b)}{b.guests != null && ` · ${b.guests} guests`}</span>
          </div>
          {check && <span className={`hint ${ok ? 'hint-grn' : 'hint-red'}`}><span className="star">✦</span> {ok ? `Fits all ${check.rules_total} rules · no clashes` : check.summary}</span>}
        </div>
        {showWhen && <span className="inbox-when">Asked {timeAgo(b.created_at)}</span>}
        <div className="attn-actions" hidden={!canAct(item)}>
          <button className="btn btn-outline" onClick={() => onOpenBooking(b.id)}>{ok ? 'Decline' : 'Review'}</button>
          <button className="btn btn-act" onClick={() => act(() => bookingsApi.approve(b.id))}>Approve</button>
        </div>
      </div>
    )
  }

  if (item.kind === 'question' && item.question) {
    return <QuestionRow q={item.question} canAnswer={can(user, 'tasks', 'manage')} act={act} />
  }

  if (item.kind === 'signups' && item.people) {
    const list = item.people
    const byRole = Object.entries(
      list.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.role]: (acc[p.role] ?? 0) + 1 }), {}),
    ).map(([role, n]) => `${n} ${ROLE_LABELS[role as Role].toLowerCase()}${n > 1 && role !== 'staff' ? 's' : ''}`)
    return (
      <div className="attn-row">
        <span className="tile-ic ic-ind"><Icon name="users" size={20} /></span>
        <div className="grow">
          <div className="attn-name">{list.length === 1 ? `${list[0].full_name} wants to join` : `${list.length} people want to join`}</div>
          <div className="attn-meta"><span>{byRole.join(' · ')} · from the sign-up page</span></div>
        </div>
        <div className="attn-actions" hidden={!canAct(item)}>
          <Link to="/admin/people?review=signups" className="btn btn-primary">Review</Link>
        </div>
      </div>
    )
  }

  return null
}
