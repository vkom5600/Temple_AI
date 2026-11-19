import { useState } from 'react'
import { fmtTime, timeAgo } from '../lib/format'
import { Icon } from './ui'
import type { Issue } from '../types'

// One "Done today" row in the Action Center: a problem that was fixed or made into
// a task. Tap it to see who reported it, what was done, and open the task it became.
export default function HandledIssue({ issue: i, phone = false, onOpenTask }: { issue: Issue; phone?: boolean; onOpenTask: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const summary = i.status === 'converted'
    ? phone ? `Given to ${i.created_task_assignee_name ?? i.created_task_group}` : <>Made into a task: "{i.created_task_title}" for {i.created_task_assignee_name ?? i.created_task_group}</>
    : <>{phone ? 'Fixed' : 'Marked fixed'} by {i.resolved_by_name}{i.resolved_at && ` · ${timeAgo(i.resolved_at)}`}</>

  // A div acting as a button, since it can hold the "Open the task" button.
  const toggle = { role: 'button', tabIndex: 0, 'aria-expanded': open, onClick: () => setOpen((o) => !o), onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o)) } as const
  const details = open && (
    <div className="handled-more">
      <span><b>Reported</b> by {i.reported_by_name ?? 'someone'} at {fmtTime(i.created_at)} · {i.category}</span>
      {i.task_title && <span><b>While doing</b> {i.task_title}</span>}
      {i.status === 'resolved' && <span><b>Fixed</b> by {i.resolved_by_name}{i.resolved_at && ` at ${fmtTime(i.resolved_at)}`}{i.resolution_note && `: ${i.resolution_note}`}</span>}
      {i.status === 'converted' && i.created_task_id && (
        <button className="link-btn" style={{ justifySelf: 'start' }} onClick={(e) => { e.stopPropagation(); onOpenTask(i.created_task_id!) }}>
          Open the task "{i.created_task_title}" <Icon name="arrow-right" size={14} />
        </button>
      )}
    </div>
  )

  if (phone) {
    return (
      <div className="m-task s-grn done">
        <div className="txt m-task-head" {...toggle}>
          <span className="t">{i.description}</span>
          <span className="m">{summary}</span>
          {details}
        </div>
      </div>
    )
  }
  return (
    <div className="attn-row handled-row" {...toggle}>
      <span className="tile-ic ic-grn"><Icon name="check" size={20} /></span>
      <div className="grow">
        <div className="attn-name">{i.description}</div>
        <div className="attn-meta"><span>{summary}</span></div>
        {details}
      </div>
      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} />
    </div>
  )
}
