import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useInbox, type InboxFilter } from '../../lib/inbox'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import InboxRow from '../../components/InboxRow'
import ConvertIssueForm from '../../components/tasks/ConvertIssueForm'
import TaskDetails from '../../components/tasks/TaskDetails'
import BookingReview from '../../components/bookings/BookingReview'
import { rulesApi } from '../../api/endpoints'
import type { Issue } from '../../types'
import HandledIssue from '../../components/HandledIssue'

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
  const [viewingBooking, setViewingBooking] = useState<number | null>(null)
  const [ruleCount, setRuleCount] = useState<number | null>(null)
  useEffect(() => { rulesApi.list().then((r) => setRuleCount(r.rules.length)).catch(() => {}) }, [])

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
        <div className="head-actions">
          <Link to="/admin/issues" className="btn btn-ghost"><Icon name="flag" size={16} /> Issue history</Link>
          <Link to="/admin/rules" className="btn btn-outline"><span className="star">✦</span> Rules Temple AI checks{ruleCount !== null && ` (${ruleCount})`} <Icon name="arrow-right" size={15} /></Link>
        </div>
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
            <InboxRow key={item.key} item={item} myId={user.id} showWhen onOpenTask={setViewing} onOpenBooking={setViewingBooking} onConvert={setConverting} act={act} />
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
              {inbox.handledToday.map((i) => <HandledIssue key={i.id} issue={i} onOpenTask={setViewing} />)}
            </section>
          )}
        </div>
      )}

      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {viewingBooking && <BookingReview bookingId={viewingBooking} onClose={() => setViewingBooking(null)} onChanged={changed} />}
      {converting && <ConvertIssueForm issue={converting} onClose={() => setConverting(null)} onDone={(m) => { toast(m); setConverting(null); changed() }} />}
    </div>
  )
}
