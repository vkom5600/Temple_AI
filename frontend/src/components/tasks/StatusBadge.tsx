import { Badge } from '../ui'
import type { Task } from '../../types'

export default function StatusBadge({ task }: { task: Task }) {
  switch (task.status) {
    case 'todo':
      return task.is_overdue ? <Badge tone="red">Overdue</Badge> : <Badge>To do</Badge>
    case 'awaiting_signoff':
      return <Badge tone="amber">Waiting for sign-off</Badge>
    case 'done':
      return task.verified_by ? <Badge tone="green">Signed off</Badge> : <Badge tone="green">Done</Badge>
    case 'flagged':
      return <Badge tone="red">Couldn't do</Badge>
    case 'cancelled':
      return <Badge>Cancelled</Badge>
  }
}
