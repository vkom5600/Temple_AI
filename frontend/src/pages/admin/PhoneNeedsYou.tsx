import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { issuesApi, tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { BRAND } from '../../branding'
import { ROLE_LABELS } from '../../constants'
import { longDate, timeAgo } from '../../lib/format'
import { jobName, quickTaskFor, useInbox, type InboxItem } from '../../lib/inbox'
import { assigneeLabel, isFinished } from '../../lib/tasks'
import { lateBy } from '../../components/InboxRow'
import NotificationBell from '../../components/NotificationBell'
import { Gopuram } from '../../components/Ornaments'
import { useToast } from '../../components/Toast'
import { Icon, Spinner } from '../../components/ui'
import TaskDetails from '../../components/tasks/TaskDetails'
import BookingReview from '../../components/bookings/BookingReview'
import { bookingSlot } from '../../lib/bookings'
import type { Task, TaskSummary } from '../../types'
import HandledIssue from '../../components/HandledIssue'
import RemindButton from '../../components/tasks/RemindButton'
import { useAccess } from '../../lib/access'

// AC1 Needs you (phone) – Rao garu's phone (designs: screens/42_AC1, final review p.12–13).
// The same admin app, laid out for a phone: everything waiting, one button per card.
// Tasks, Calendar, People and Reports stay on the temple computer.
interface Props {
  context: { summary: TaskSummary | null; refreshSummary: () => void; openBroadcast: () => void; openAskAi: () => void }
}

export default function PhoneNeedsYou({ context }: Props) {
  const access = useAccess()
  const { user, logout } = useAuth()
  const toast = useToast()
  const isChairman = user?.role === 'chairman'
  const { inbox, reload } = useInbox(isChairman)
  const [today, setToday] = useState<Task[] | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [viewingBooking, setViewingBooking] = useState<number | null>(null)

  const loadToday = useCallback(() => { tasksApi.list({ view: 'today' }).then((r) => setToday(r.tasks)).catch(() => {}) }, [])
  useEffect(loadToday, [loadToday])

  const changed = () => { reload(); loadToday(); context.refreshSummary() }
  const act = async (action: () => Promise<{ message: string }>) => {
    try { toast((await action()).message); changed() } catch (err) { toast((err as Error).message) }
  }

  if (!user) return null
  const items = inbox?.items ?? []
  const here = inbox?.day?.counts.here ?? 0
  const done = today?.filter(isFinished).length ?? 0
  const overdue = context.summary?.overdue ?? 0

  return (
    <div className="mobile">
      <Gopuram className="page-watermark" />
      <div className="accent-line" />
      <header className="m-top">
        <img className="logo" src={BRAND.logo} alt={BRAND.templeName} />
        <div className="who"><b>Namaste, {user.full_name.split(' ')[0]}</b><span>{ROLE_LABELS[user.role]}</span></div>
        <NotificationBell />
      </header>

      <div className="m-wrap">
        <section className="m-hero">
          <div className="date">{longDate()}</div>
          <h1>{items.length ? `${items.length} thing${items.length > 1 ? 's' : ''} need${items.length > 1 ? '' : 's'} you` : 'All clear'}</h1>
          <div className="hchips">
            <span className="hchip"><i className="hdot grn" /> {here} on site</span>
            <span className="hchip">{done} of {today?.length ?? 0} tasks done</span>
            {overdue > 0 && <span className="hchip"><i className="hdot red" /> {overdue} overdue</span>}
          </div>
        </section>

        <div className="m-sec"><h2>Needs you</h2><span>Most urgent first</span></div>
        {!inbox && <Spinner />}
        {inbox && !items.length && <p className="muted center">Nothing is waiting for you. 🙏</p>}
        {items.map((item) => <PhoneCard key={item.key} item={item} myId={user.id} onOpen={setViewing} onOpenBooking={setViewingBooking} act={act} />)}

        {inbox && inbox.handledToday.length > 0 && (
          <>
            <button className="done-toggle" style={{ alignSelf: 'center' }} onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              Done today ({inbox.handledToday.length}) <Icon name="chevron-down" size={16} />
            </button>
            {showDone && inbox.handledToday.map((i) => <HandledIssue key={i.id} issue={i} phone onOpenTask={setViewing} />)}
          </>
        )}

        <div className="m-actions">
          {access.allowed('broadcast') && <button className="btn btn-outline" onClick={context.openBroadcast}><Icon name="send" /> Broadcast</button>}
          {access.allowed('ai') && <button className="btn btn-outline" onClick={context.openAskAi}><span className="star">✦</span> Ask AI</button>}
        </div>
        <p className="fine">Tasks, Calendar, People and Reports are on the temple computer.</p>
        <button className="signout" onClick={logout}>Sign out</button>
      </div>
      {viewing && <TaskDetails taskId={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
      {viewingBooking && <BookingReview bookingId={viewingBooking} onClose={() => setViewingBooking(null)} onChanged={changed} />}
    </div>
  )
}

// One card, one main button (design: "one button per card").
function PhoneCard({ item, myId, onOpen, onOpenBooking, act }: { item: InboxItem; myId: number; onOpen: (id: number) => void; onOpenBooking: (id: number) => void; act: (a: () => Promise<{ message: string }>) => void }) {
  const { task, issue } = item
  if (item.kind === 'overdue' && task) {
    return (
      <div className="m-task s-red">
        <div className="txt">
          <div className="t">{task.title}</div>
          <div className="m red">{assigneeLabel(task)} · overdue by {lateBy(task.due_at!)}</div>
          {task.requires_verification && <div className="m saf-text"><span className="star">✦</span> Safety task, so it's first</div>}
        </div>
        {task.assigned_to === myId
          ? <button className="btn btn-primary" onClick={() => act(() => tasksApi.complete(task.id))}>Done</button>
          : <RemindButton task={task} act={act} className="btn btn-primary" />}
      </div>
    )
  }
  if (item.kind === 'problem' && issue) {
    const helper = item.helper
    return (
      <div className="m-task s-saf">
        <div className="txt">
          <div className="t">{issue.description}</div>
          <div className="m">Reported by {issue.reported_by_name ?? 'someone'} · {timeAgo(issue.created_at)}</div>
          <div className="m saf-text"><span className="star">✦</span> {helper ? `${helper.full_name.split(' ')[0]} (${jobName(issue)})` : jobName(issue)} {helper ? 'can do it' : 'should look at it'}</div>
        </div>
        {helper
          ? <button className="btn btn-primary" onClick={() => act(() => issuesApi.convert(issue.id, quickTaskFor(issue, helper)))}>Assign {helper.full_name.split(' ')[0]}</button>
          : <button className="btn btn-primary" onClick={() => act(() => issuesApi.resolve(issue.id, ''))}>Mark fixed</button>}
      </div>
    )
  }
  if (item.kind === 'signoff' && task) {
    return (
      <div className="m-task s-saf">
        <div className="txt">
          <div className="t">{task.title}</div>
          <div className="m">{task.completed_by_name} · done {task.completed_at ? timeAgo(task.completed_at) : ''} · needs a second check</div>
        </div>
        {task.completed_by === myId
          ? <button className="btn btn-outline" onClick={() => onOpen(task.id)}>Open</button>
          : <button className="btn btn-primary" onClick={() => act(() => tasksApi.verify(task.id))}>Sign off</button>}
      </div>
    )
  }
  if (item.kind === 'booking' && item.booking) {
    const b = item.booking.booking
    const ok = item.booking.check?.recommendation === 'approve'
    return (
      <div className={`m-task ${ok ? 's-grn' : 's-red'}`}>
        <div className="txt">
          <div className="t">Hall booking · {bookingSlot(b).split(' · ')[0]}</div>
          <div className="m">{b.title} · {b.resource_name}{b.guests != null && ` · ${b.guests} guests`}</div>
          {item.booking.check && <div className={`m ${ok ? '' : 'red'}`} style={ok ? { color: 'var(--green)' } : undefined}><span className="star">✦</span> {ok ? `Fits all ${item.booking.check.rules_total} rules · no clashes` : item.booking.check.summary}</div>}
        </div>
        <button className="btn btn-primary" onClick={() => onOpenBooking(b.id)}>Review</button>
      </div>
    )
  }
  if (item.kind === 'signups' && item.people) {
    return (
      <div className="m-task s-ind">
        <div className="txt">
          <div className="t">{item.people.length === 1 ? `${item.people[0].full_name} wants to join` : `${item.people.length} people want to join`}</div>
          <div className="m">From the sign-up page</div>
        </div>
        <Link className="btn btn-primary" to="/admin/people?review=signups">Review</Link>
      </div>
    )
  }
  return null
}
