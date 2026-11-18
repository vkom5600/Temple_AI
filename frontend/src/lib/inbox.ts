import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, bookingsApi, issuesApi, tasksApi, usersApi } from '../api/endpoints'
import { TASK_GROUP_LABELS } from '../constants'
import { suggestGroup, suggestedTitle } from './tasks'
import type { AttendanceDay, BookingDetail, Issue, Task, TaskInput, User } from '../types'

// Everything waiting for the chairman / committee, in one list.
// Used by H1 Home ("Needs your attention") and AC1 Action Center, so both agree.
//   overdue  – a task past its time        → Remind / Reassign
//   problem  – a reported issue            → Assign <name> / Create task / Mark fixed
//   signoff  – a safety task to check      → Sign off / Review
//   signups  – people who registered       → Review (chairman)
//   booking  – a hall / room request       → Decline / Approve (AC2)

export type InboxKind = 'overdue' | 'problem' | 'signoff' | 'signups' | 'booking'
export type InboxFilter = 'all' | 'approvals' | 'problems' | 'overdue'

export interface InboxItem {
  key: string
  kind: InboxKind
  filter: Exclude<InboxFilter, 'all'>
  rank: number
  task?: Task
  issue?: Issue
  people?: User[]
  booking?: BookingDetail
  helper?: User // who to give a problem to (someone with the right job, on site if possible)
}

export interface Inbox {
  items: InboxItem[]
  people: User[]
  day: AttendanceDay | null
  handledToday: Issue[]
}

const isTodayIso = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString()

export function useInbox(isChairman: boolean) {
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    Promise.all([
      tasksApi.list({ view: 'overdue' }),
      issuesApi.list('open'),
      tasksApi.signoffs(),
      usersApi.list(),
      attendanceApi.day().catch(() => null),
      issuesApi.list('handled').catch(() => ({ issues: [] as Issue[] })),
      // Booking requests, each with its rule check (there are only ever a few waiting)
      bookingsApi.list({ status: 'pending' }).then((r) => Promise.all(r.bookings.map((b) => bookingsApi.get(b.id)))).catch(() => [] as BookingDetail[]),
    ])
      .then(([overdue, issues, signoffs, users, day, handled, bookings]) => {
        setError('')
        const people = users.users
        const onSite = new Set(day?.people.filter((p) => p.state === 'here').map((p) => p.user_id))
        const helperFor = (issue: Issue) => {
          const job = suggestGroup(issue.description)
          const able = people.filter((p) => p.is_active && p.approval_status === 'approved' && p.designation === job)
          return able.find((p) => onSite.has(p.id)) ?? able[0]
        }

        const items: InboxItem[] = []
        for (const t of overdue.tasks) {
          items.push({ key: `t${t.id}`, kind: 'overdue', filter: 'overdue', rank: t.requires_verification ? 0 : 3, task: t })
        }
        for (const i of issues.issues) {
          items.push({ key: `i${i.id}`, kind: 'problem', filter: 'problems', rank: 1, issue: i, helper: helperFor(i) })
        }
        for (const t of signoffs.tasks) {
          items.push({ key: `s${t.id}`, kind: 'signoff', filter: 'approvals', rank: 2, task: t })
        }
        for (const detail of bookings) {
          items.push({ key: `b${detail.booking.id}`, kind: 'booking', filter: 'approvals', rank: 2, booking: detail })
        }
        const pending = people.filter((p) => p.approval_status === 'pending')
        if (isChairman && pending.length) {
          items.push({ key: 'signups', kind: 'signups', filter: 'approvals', rank: 2, people: pending })
        }
        items.sort((a, b) => a.rank - b.rank)

        const handledToday = handled.issues.filter((i) => isTodayIso(i.resolved_at) || (i.status === 'converted' && isTodayIso(i.resolved_at)))
        setInbox({ items, people, day, handledToday })
      })
      .catch((e: Error) => setError(e.message))
  }, [isChairman])

  useEffect(load, [load])
  return { inbox, error, reload: load }
}

// The one-line tip at the top of "Needs your attention" (rule-based until the AI assistant).
export function topTip(items: InboxItem[]): string | null {
  const first = items[0]
  if (!first) return null
  if (first.kind === 'overdue' && first.task) {
    const t = first.task
    if (t.requires_verification) return `Start with "${t.title}": it's a safety task${t.last_reminded_at ? ' and still not done after a reminder' : ''}.`
    return `Start with "${t.title}": it's the most overdue.`
  }
  if (first.kind === 'problem' && first.issue) {
    return `Start with "${first.issue.description}": it was reported and nobody is on it yet.`
  }
  if (first.kind === 'signoff' && first.task) return `"${first.task.title}" is done and needs a second check.`
  return null
}

// "Assign Harish": turn the problem into a task for that person, straight away.
export function quickTaskFor(issue: Issue, person: User): TaskInput {
  const job = suggestGroup(issue.description)
  const due = new Date(Date.now() + 3 * 3600_000)
  due.setMinutes(0, 0, 0)
  return {
    title: suggestedTitle(issue.description),
    description: `Reported by ${issue.reported_by_name ?? 'staff'}: ${issue.description}`,
    category: job === 'maintenance' ? 'Maintenance' : 'General',
    area: '',
    assigned_to: person.id,
    assigned_group: null,
    priority: 'high',
    requires_verification: false,
    due_at: due.toISOString(),
    recurrence: 'none',
  }
}

export const jobName = (issue: Issue) => TASK_GROUP_LABELS[suggestGroup(issue.description)]
