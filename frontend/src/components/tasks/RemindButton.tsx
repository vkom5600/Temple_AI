import { tasksApi } from '../../api/endpoints'
import { timeAgo } from '../../lib/format'
import { justReminded } from '../../lib/tasks'
import { Icon } from '../ui'
import type { Task } from '../../types'

// Remind: pings the people on the task (notification on their phone, an email if
// email is set up) and shows "Reminder from Raghu" on their task card. Right after
// sending it shows "Reminded" for 5 minutes, so nobody sends it twice.
export default function RemindButton({ task, act, className = 'btn btn-outline' }: {
  task: Task
  act: (action: () => Promise<{ message: string }>) => void
  className?: string
}) {
  if (justReminded(task)) {
    return (
      <button className={`${className} reminded`} disabled title={`Reminded ${timeAgo(task.last_reminded_at!)}. You can remind again after 5 minutes.`}>
        <Icon name="check" size={16} /> Reminded
      </button>
    )
  }
  return (
    <button className={className} onClick={() => act(() => tasksApi.remind(task.id))}>
      <Icon name="bell" size={16} /> Remind
    </button>
  )
}
