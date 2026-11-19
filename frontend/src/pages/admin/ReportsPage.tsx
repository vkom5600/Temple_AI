import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { attendanceApi, auditApi, issuesApi, tasksApi } from '../../api/endpoints'
import { BRAND } from '../../branding'
import { toDateInput } from '../../lib/format'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Spinner } from '../../components/ui'
import type { AttendanceDay, AuditEntry, Issue, Task } from '../../types'

// R1 Reports (Summary) and R2 Activity log (designs: screens/30_R1, 31_R2).
// "How the temple is doing, and a record of every change."
// The summary is written from the records (rule-based); Phase 4 adds the nightly
// AI-written version, emailed to the committee.
type Tab = 'summary' | 'log'

export default function ReportsPage() {
  const { openBroadcast } = useAdminContext()
  const [tab, setTab] = useState<Tab>('summary')
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Reports</h1>
          <p>How the temple is doing, and a record of every change.</p>
        </div>
        <button className="btn btn-outline" onClick={openBroadcast}><Icon name="send" size={16} /> Broadcast</button>
      </header>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'summary'} className={`tab ${tab === 'summary' ? 'on' : ''}`} onClick={() => setTab('summary')}>Summary</button>
        <button role="tab" aria-selected={tab === 'log'} className={`tab ${tab === 'log' ? 'on' : ''}`} onClick={() => setTab('log')}>Activity log</button>
      </div>
      {tab === 'summary' ? <Summary /> : <ActivityLog />}
    </div>
  )
}

// ---------------------------------------------------------------- R1 Summary

type Span = 'daily' | 'weekly' | 'monthly'
const DAY = 86_400_000

function periodOf(span: Span, offset: number): { from: Date; to: Date; label: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (span === 'daily') {
    const from = new Date(today.getTime() + offset * DAY)
    return { from, to: from, label: from.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) }
  }
  if (span === 'weekly') {
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const f = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    return { from: monday, to: sunday, label: `${f(monday)} – ${f(sunday)}` }
  }
  const from = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const to = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0)
  return { from, to, label: from.toLocaleDateString([], { month: 'long', year: 'numeric' }) }
}

const inRange = (iso: string | null, from: Date, to: Date) => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t < to.getTime() + DAY
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

function Summary() {
  const toast = useToast()
  const [span, setSpan] = useState<Span>('weekly')
  const [offset, setOffset] = useState(0)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [days, setDays] = useState<AttendanceDay[] | null>(null)
  const [made, setMade] = useState(new Date())
  const period = useMemo(() => periodOf(span, offset), [span, offset])

  const load = useCallback(() => {
    setMade(new Date())
    tasksApi.list({ view: 'all' }).then((r) => setTasks(r.tasks)).catch(() => setTasks([]))
    Promise.all([issuesApi.list('open'), issuesApi.list('handled')]).then(([a, b]) => setIssues([...a.issues, ...b.issues])).catch(() => {})
    // Attendance for each day of the period up to today
    const list: string[] = []
    for (const d = new Date(period.from); d <= period.to && d <= new Date(); d.setDate(d.getDate() + 1)) list.push(toDateInput(d))
    setDays(null)
    Promise.all(list.map((d) => attendanceApi.day(d).catch(() => null))).then((r) => setDays(r.filter(Boolean) as AttendanceDay[]))
  }, [period])
  useEffect(load, [load])

  const prev = periodOf(span, offset - 1)
  const due = (tasks ?? []).filter((t) => inRange(t.due_at, period.from, period.to) && new Date(t.due_at!) <= new Date())
  const duePrev = (tasks ?? []).filter((t) => inRange(t.due_at, prev.from, prev.to))
  const finished = (list: Task[]) => list.filter((t) => t.status === 'done' || t.status === 'awaiting_signoff').length
  const donePct = pct(finished(due), due.length)
  const change = donePct - pct(finished(duePrev), duePrev.length)
  const late = due.filter((t) => t.completed_at && t.due_at && new Date(t.completed_at) > new Date(t.due_at))
  const sentBack = due.filter((t) => t.last_comment_type === 'sent_back')
  const overdue = due.filter((t) => t.status === 'todo' && t.is_overdue)
  const lateByTitle = Object.entries([...late, ...overdue].reduce<Record<string, number>>((m, t) => ({ ...m, [t.title]: (m[t.title] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])

  // Attendance: share of expected people who came, per day
  const expected = (days ?? []).reduce((n, d) => n + d.people.length - d.counts.absent, 0)
  const came = (days ?? []).reduce((n, d) => n + d.counts.here + d.counts.left, 0)
  const perPerson = new Map<string, { came: number; of: number }>()
  for (const d of days ?? []) for (const p of d.people) {
    const r = perPerson.get(p.full_name) ?? { came: 0, of: 0 }
    if (p.state !== 'absent') r.of += 1
    if (p.state === 'here' || p.state === 'left') r.came += 1
    perPerson.set(p.full_name, r)
  }
  const everyDay = [...perPerson.entries()].filter(([, r]) => r.of > 0 && r.came === r.of).map(([n]) => n)
  const missed = [...perPerson.entries()].filter(([, r]) => r.came < r.of).sort((a, b) => a[1].came / a[1].of - b[1].came / b[1].of)

  const reported = issues.filter((i) => inRange(i.created_at, period.from, period.to))
  const fixed = reported.filter((i) => i.status !== 'open')
  const stillOpen = issues.filter((i) => i.status === 'open')
  const unlocked = (days ?? []).filter((d) => d.closing && !d.closing.confirmed)

  const title = span === 'daily' ? 'Daily report' : span === 'weekly' ? 'Weekly report' : 'Monthly report'
  const sections: { h: string; p: ReactNode; text: string }[] = []
  const tasksText = due.length
    ? `${finished(due)} of ${due.length} tasks were completed (${donePct}%${offset > -100 && duePrev.length ? `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% on the period before` : ''}). ${late.length ? `${late.length} were finished late. ` : ''}${sentBack.length ? `${sentBack.length} ${sentBack.length === 1 ? 'was' : 'were'} sent back for another go. ` : ''}${overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'is' : 'are'} still overdue.` : 'Nothing is left overdue.'}`
    : 'No tasks were due in this period.'
  const attText = expected
    ? `Staff and volunteers came in on ${pct(came, expected)}% of their days.${everyDay.length ? ` ${everyDay.slice(0, 4).join(', ')} came in every day.` : ''}${missed.length ? ` ${missed[0][0]} came ${missed[0][1].came} of ${missed[0][1].of} days.` : ''}${unlocked.length ? ` On ${unlocked.length} ${unlocked.length === 1 ? 'day' : 'days'} the last person left without finishing the lock-up checks.` : ''}`
    : 'No attendance was recorded in this period.'
  const issueText = reported.length
    ? `${reported.length} problem${reported.length === 1 ? ' was' : 's were'} reported and ${fixed.length} ${fixed.length === 1 ? 'has' : 'have'} been sorted.${stillOpen.length ? ` Still open: ${stillOpen.slice(0, 2).map((i) => `"${i.description}"`).join(', ')}.` : ''}`
    : 'No problems were reported.'
  const summaryText = `${donePct >= 90 ? 'A steady' : donePct >= 70 ? 'A mostly good' : 'A busy'} ${span === 'daily' ? 'day' : span === 'weekly' ? 'week' : 'month'}. ${donePct}% of tasks were finished${lateByTitle[0] && lateByTitle[0][1] > 1 ? `; "${lateByTitle[0][0]}" ran late ${lateByTitle[0][1]} times, so it may need an earlier slot or a second person` : ''}.`
  sections.push({ h: 'Summary', text: summaryText, p: summaryText })
  sections.push({ h: 'Tasks', text: tasksText, p: tasksText })
  sections.push({ h: 'Attendance', text: attText, p: attText })
  sections.push({ h: 'Bookings', text: 'Hall bookings start in Phase 3.', p: <span className="muted">Hall bookings start in Phase 3, with Google Calendar.</span> })
  sections.push({ h: 'Issues', text: issueText, p: issueText })

  const copy = async () => {
    const text = `${BRAND.templeName} · ${title} · ${period.label}\n\n${sections.map((s) => `${s.h}\n${s.text}`).join('\n\n')}`
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into an email.') } catch { toast("Couldn't copy on this browser") }
  }

  return (
    <>
      <div className="row" style={{ gap: 16 }}>
        <div className="segmented">
          {(['daily', 'weekly', 'monthly'] as Span[]).map((s) => <button key={s} className={span === s ? 'on' : ''} onClick={() => { setSpan(s); setOffset(0) }}>{s[0].toUpperCase() + s.slice(1)}</button>)}
        </div>
        <div className="month-nav" style={{ border: 0, background: 'none' }}>
          <button className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Previous"><Icon name="chevron-right" size={18} /></button>
          <b style={{ minWidth: 150, fontSize: 16 }}>{period.label}</b>
          <button className="icon-btn" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset === 0} aria-label="Next"><Icon name="chevron-right" size={18} /></button>
        </div>
      </div>

      <section className="panel report">
        <div className="report-head">
          <span className="tile-ic ic-saf" style={{ width: 52, height: 52 }}><span className="star" style={{ fontSize: 26 }}>✦</span></span>
          <div className="grow">
            <h2>{title}</h2>
            <span className="muted small">Made from the records · {made.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, {made.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          </div>
          <div className="row no-print">
            <button className="btn btn-outline btn-sm" onClick={load}><Icon name="repeat" size={14} /> Regenerate</button>
            <button className="btn btn-outline btn-sm" onClick={copy}><Icon name="mail" size={14} /> Copy as email</button>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Icon name="download" size={14} /> Download PDF</button>
          </div>
        </div>

        {(!tasks || !days) ? <Spinner /> : (
          <>
            <div className="report-stats">
              <div><small>Tasks done</small><b>{donePct}% {duePrev.length > 0 && <em className={change >= 0 ? 'up' : 'down'}>({change >= 0 ? '↑' : '↓'}{Math.abs(change)}%)</em>}</b></div>
              <div><small>Attendance</small><b>{pct(came, expected)}%</b></div>
              <div><small>Bookings</small><b>—</b></div>
              <div><small>Open issues</small><b>{stillOpen.length}</b></div>
              {(overdue.length > 0 || stillOpen.length > 0 || lateByTitle.some(([, n]) => n > 1)) && (
                <div className="report-attn">
                  <span className="ulabel">Needs attention</span>
                  {lateByTitle.filter(([, n]) => n > 1).slice(0, 1).map(([t, n]) => <span key={t}><i className="hdot" style={{ background: 'var(--saf)' }} /> {t} late {n} times <Link to="/admin/tasks?tab=all">Adjust</Link></span>)}
                  {overdue.length > 0 && <span><i className="hdot red" /> {overdue.length} task{overdue.length > 1 ? 's' : ''} still overdue <Link to="/admin/action-center">Review</Link></span>}
                  {stillOpen.slice(0, 1).map((i) => <span key={i.id}><i className="hdot red" /> {i.description} <Link to="/admin/action-center">View issue</Link></span>)}
                </div>
              )}
            </div>
            <div className="report-body">
              {sections.map((s) => <section key={s.h}><h3>{s.h}</h3><p>{s.p}</p></section>)}
              <p className="muted small" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>Made automatically from the Temple AI records. The AI-written nightly report arrives in Phase 4.</p>
            </div>
          </>
        )}
      </section>
    </>
  )
}

// ---------------------------------------------------------------- R2 Activity log

const TYPES: { id: string; label: string }[] = [
  { id: '', label: 'Everything' },
  { id: 'task', label: 'Tasks' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'user', label: 'People' },
  { id: 'issue', label: 'Problems' },
  { id: 'broadcast', label: 'Broadcasts' },
  { id: 'setting', label: 'Settings' },
]
const TAG: Record<string, string> = { task: 'task', attendance: 'attendance', user: 'people', issue: 'problem', broadcast: 'broadcast', setting: 'setting' }
const PAGE = 50

function describe(a: AuditEntry): ReactNode {
  const who = <b>{a.actor_name ?? 'Temple AI'}</b>
  const d = a.details as Record<string, string | number | boolean | undefined>
  const task = `"${a.task_title ?? 'a task'}"`
  const person = a.target_name ?? 'someone'
  const att = a.attendance_name
  const self = att && att === a.actor_name
  switch (a.action) {
    case 'task.created': return <>{who} assigned {task}</>
    case 'task.completed': return <>{who} completed {task}{d.awaiting_signoff || d.status === 'awaiting_signoff' ? ' (waiting for sign-off)' : ''}</>
    case 'task.verified': return <>{who} approved {task}</>
    case 'task.sent_back': return <>{who} sent back {task}{d.note ? `: "${d.note}"` : ''}</>
    case 'task.flagged': return <>{who} couldn't do {task}</>
    case 'task.reminded': return <>{who} sent a reminder about {task}</>
    case 'task.updated': return <>{who} edited {task}</>
    case 'task.cancelled': return <>{who} deleted {task}</>
    case 'task.reopened': return <>{who} reopened {task}</>
    case 'task.undone': return <>{who} undid {task}</>
    case 'task.repeats_created': return <><b>Daily routine</b> created {String(d.count ?? d.created ?? 'the')} repeating tasks</>
    case 'issue.reported': return <>{who} reported a problem: "{a.issue_text}"</>
    case 'issue.resolved': return <>{who} marked fixed: "{a.issue_text}"</>
    case 'issue.converted': return <>{who} made a task from: "{a.issue_text}"</>
    case 'user.registered': return <>{who} signed up to join</>
    case 'user.approved': return <>{who} approved {person}'s sign-up</>
    case 'user.rejected': return <>{who} turned down {person}'s sign-up</>
    case 'user.created': return <>{who} added {person}</>
    case 'user.updated': return <>{who} updated {person}'s details</>
    case 'user.logged_in': return <>{who} signed in</>
    case 'attendance.checked_in': return self || !att ? <>{who} checked in</> : <>{who} checked {att} in</>
    case 'attendance.checked_out': return <>{who} left{d.closing_confirmed || d.confirmed ? ' and locked up' : ''}</>
    case 'attendance.returned': return <>{who} came back</>
    case 'attendance.check_in_undone': return <>{who} undid their check-in (tapped by mistake)</>
    case 'attendance.marked_absent': return <>{who} marked {att ?? 'someone'} absent</>
    case 'attendance.added': return <>{who} added {att ?? 'someone'}'s attendance</>
    case 'attendance.corrected': return <>{who} corrected {att ?? 'someone'}'s attendance</>
    case 'attendance.removed': return <>{who} removed an attendance record</>
    case 'attendance.closing_alert': return <><b>Evening check</b> alerted the chairman about the lock-up</>
    case 'setting.updated': return <>{who} changed a setting{d.key ? ` (${String(d.key).replace(/_/g, ' ')})` : ''}</>
    case 'broadcast.sent': return <>{who} sent a broadcast to {String(d.recipients ?? '')} people{d.message ? `: "${d.message}"` : ''}</>
    default: return <>{who} {a.action.replace(/[._]/g, ' ')}</>
  }
}

function dayLabel(iso: string) {
  const d = new Date(iso); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1)
  if (d.toDateString() === t.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

function ActivityLog() {
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { const id = setTimeout(() => setQ(query), 300); return () => clearTimeout(id) }, [query])
  const load = useCallback((offset = 0) => {
    setError('')
    auditApi.list({ entity_type: type, q, limit: PAGE, offset })
      .then((r) => { setRows((old) => (offset ? [...(old ?? []), ...r.auditLogs] : r.auditLogs)); setMore(r.auditLogs.length === PAGE) })
      .catch((e: Error) => setError(e.message))
  }, [type, q])
  useEffect(() => { setRows(null); load(0) }, [load])

  // Sign-ins are recorded but left out of "Everything" to keep the log readable.
  const shown = (rows ?? []).filter((a) => type === 'user' || a.action !== 'user.logged_in')
  const groups: [string, AuditEntry[]][] = []
  for (const a of shown) {
    const label = dayLabel(a.created_at)
    const g = groups.find(([l]) => l === label)
    if (g) g[1].push(a)
    else groups.push([label, [a]])
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">Every important change, with who made it. Kept for accountability.</span>
        <div className="row">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Show" style={{ width: 'auto' }}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label className="search" style={{ minWidth: 240 }}>
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the log" aria-label="Search the log" />
          </label>
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <section className="panel">
        {!rows && !error && <Spinner />}
        {rows && !shown.length && <p className="muted">Nothing recorded{q ? ` for "${q}"` : ''}.</p>}
        {groups.map(([label, list]) => (
          <div key={label} className="log-group">
            <span className="ulabel">{label}</span>
            {list.map((a) => (
              <div key={a.id} className="log-row">
                <time>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
                <span className="grow">{describe(a)}</span>
                {a.entity_type && <span className="log-tag">{TAG[a.entity_type] ?? a.entity_type}</span>}
              </div>
            ))}
          </div>
        ))}
        {more && <button className="done-toggle" style={{ margin: '8px auto 0', display: 'flex' }} onClick={() => load(rows?.length ?? 0)}><Icon name="chevron-down" size={16} /> Load older</button>}
      </section>
    </>
  )
}
