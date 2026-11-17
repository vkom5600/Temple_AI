import { useEffect, useState } from 'react'
import { issuesApi, tasksApi } from '../../api/endpoints'
import { Icon, Spinner } from '../../components/ui'
import type { Issue, Task } from '../../types'

// R1 Reports / R2 Activity log (designs: screens/30_R1, 31_R2).
// The nightly written report (email + PDF to the committee) and the activity log page
// come in Phase 4. Until then: this week's numbers, worked out from the records.
export default function ReportsPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])

  useEffect(() => {
    tasksApi.list({ view: 'all' }).then((r) => setTasks(r.tasks)).catch(() => setTasks([]))
    Promise.all([issuesApi.list('open'), issuesApi.list('handled')]).then(([a, b]) => setIssues([...a.issues, ...b.issues])).catch(() => {})
  }, [])

  const weekAgo = Date.now() - 7 * 86_400_000
  const week = (tasks ?? []).filter((t) => new Date(t.due_at).getTime() >= weekAgo && new Date(t.due_at).getTime() <= Date.now())
  const done = week.filter((t) => t.status === 'done' || t.status === 'awaiting_signoff').length
  const late = week.filter((t) => t.completed_at && new Date(t.completed_at) > new Date(t.due_at)).length
  const overdue = week.filter((t) => t.status === 'todo' && t.is_overdue).length
  const safety = week.filter((t) => t.requires_verification)
  const signed = safety.filter((t) => t.verified_by).length
  const reported = issues.filter((i) => new Date(i.created_at).getTime() >= weekAgo)

  const stat = (label: string, value: string | number, note?: string) => (
    <section className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
    </section>
  )

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Reports</h1>
          <p>How the temple ran this week</p>
        </div>
        <button className="btn btn-outline" disabled title="Comes in Phase 4"><Icon name="mail" size={16} /> Email to committee</button>
      </header>
      <div className="ai-banner"><span className="star">✦</span> The written nightly report (PDF and email to the committee) and the full activity log come in Phase 4. These numbers are live.</div>
      {!tasks && <Spinner />}
      {tasks && (
        <div className="kpis">
          {stat('Tasks done (7 days)', `${done} of ${week.length}`, `${late} finished late`)}
          {stat('Overdue now', overdue, overdue ? 'Still waiting on someone' : 'Nothing late')}
          {stat('Safety checks', `${signed} of ${safety.length}`, 'signed off by a second person')}
          {stat('Problems reported', reported.length, `${reported.filter((i) => i.status !== 'open').length} sorted`)}
        </div>
      )}
    </div>
  )
}
