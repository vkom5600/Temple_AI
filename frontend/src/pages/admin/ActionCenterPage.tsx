import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { timeAgo } from '../../lib/format'
import { useInbox, type InboxFilter } from '../../lib/inbox'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import InboxRow from '../../components/InboxRow'
import ConvertIssueForm from '../../components/tasks/ConvertIssueForm'
import TaskDetails from '../../components/tasks/TaskDetails'
import type { Issue } from '../../types'

// AC1 Action Center (design: screens/10_AC1_action-center.png): everything waiting,
// one main action per row. Booking requests join "Approvals" in Phase 3.
const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'problems', label: 'Problems' },
  { id: 'overdue', label: 'Overdue' },
]

export default function ActionCenterPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { refreshSummary } = useAdminContext()
  const { inbox, error, reload } = useInbox(user?.role === 'chairman')
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [viewing, setViewing] = useState<number | null>(null)
  const [converting, setConverting] = useState<Issue | null>(null)
  const [showDone, setShowDone] = useState(false)

  const changed = () => { reload(); refreshSummary() }
  const act = async (action: () => Promise<{ message: string }>) => {
    try {
      toast((await action()).message)
      changed()
    } catch (err) {
      toast((err as Error).message)
    }
  }

  if (!user) return null
  const items = inbox?.items ?? []
  const count = (f: InboxFilter) => (f === 'all' ? items.length : items.filter((i) => i.filter === f).length)
  const shown = filter === 'all' ? items : items.filter((i) => i.filter === filter)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Action Center</h1>
          <p>Everything waiting for you</p>
        </div>
        <Link to="/admin/issues" className="btn btn-outline"><Icon name="flag" size={16} /> Issue history</Link>
      </header>

      <div className="fchips" role="tablist" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={`fchip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label} {count(f.id)}
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!inbox && !error && <Spinner />}

      {inbox && !shown.length && (
        <section className="panel center" style={{ padding: '48px 28px' }}>
          <span className="tile-ic ic-grn" style={{ margin: '0 auto 12px' }}><Icon name="check" size={22} /></span>
          <h2>All clear</h2>
          <p className="muted">Nothing {filter === 'all' ? '' : `in ${FILTERS.find((f) => f.id === filter)!.label.toLowerCase()} `}is waiting for you.</p>
        </section>
      )}

      {shown.length > 0 && (
        <section className="list-card inbox">
          {shown.map((item) => (
            <InboxRow key={item.key} item={item} myId={user.id} showWhen onOpenTask={setViewing} onConvert={setConverting} act={act} />
          ))}
        </section>
      )}

      {inbox && inbox.handledToday.length > 0 && (
        <div>
          <button className="done-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            Done today ({inbox.handledToday.length}) <Icon name="chevron-down" size={16} />
          </button>
          {showDone && (
            <section className="list-card inbox" style={{ marginTop: 10 }}>
              {inbox.handledToday.map((i) => (
                <div key={i.id} className="attn-row">
                  <span className="tile-ic ic-grn"><Icon name="check" size={20} /></span>
                  <div className="grow">
                    <div className="attn-name">{i.description}</div>
                    <div className="attn-meta">
                      {i.status === 'converted'
                        ? <span>Made into a task: "{i.created_task_title}" for {i.created_task_assignee_name ?? i.created_task_group}</span>
                        : <span>Marked fixed by {i.resolved_by_name}{i.resolved_at && ` · ${timeAgo(i.resolved_at)}`}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {converting && <ConvertIssueForm issue={converting} onClose={() => setConverting(null)} onDone={(m) => { toast(m); setConverting(null); changed() }} />}
    </div>
  )
}
