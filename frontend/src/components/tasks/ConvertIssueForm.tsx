import { issuesApi } from '../../api/endpoints'
import { suggestGroup, suggestedTitle } from '../../lib/tasks'
import TaskForm from './TaskForm'
import type { Issue } from '../../types'

// "Create task" on a reported problem: a task form filled in with a guess at
// who should do it. Used on the Issues page and the dashboard.
export default function ConvertIssueForm({ issue, onClose, onDone }: {
  issue: Issue
  onClose: () => void
  onDone: (message: string) => void
}) {
  const group = suggestGroup(issue.description)
  return (
    <TaskForm
      title="Create a task from this issue"
      submitLabel="Create task"
      initial={{
        title: suggestedTitle(issue.description),
        assigned_group: group,
        description: `Reported by ${issue.reported_by_name ?? 'staff'}: ${issue.description}`,
        priority: 'high',
        category: group === 'maintenance' ? 'Maintenance' : 'General',
      }}
      onClose={onClose}
      onSubmit={async ([input]) => {
        const r = await issuesApi.convert(issue.id, input)
        onDone(r.message)
      }}
    />
  )
}
