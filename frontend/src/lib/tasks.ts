import { TASK_GROUP_LABELS } from '../constants'
import type { Task, TaskGroup } from '../types'

// Who a task is for, in words: "Cleaner (everyone)" or "Ramesh".
export const assigneeLabel = (t: Pick<Task, 'assigned_group' | 'assigned_to_name'>): string =>
  t.assigned_group ? `${TASK_GROUP_LABELS[t.assigned_group]} (everyone)` : t.assigned_to_name ?? 'Nobody'

export const isFinished = (t: Task) => t.status === 'done' || t.status === 'awaiting_signoff'

export const repeatLabel = (t: Pick<Task, 'recurrence'>) =>
  t.recurrence === 'daily' ? 'Every day' : t.recurrence === 'weekly' ? 'Every week' : null

// Simple keyword guesses for turning a reported problem into a task.
// (Phase 3's AI assistant can replace this.)
export function suggestGroup(text: string): TaskGroup {
  const t = text.toLowerCase()
  if (/(gas|stove|cook|kitchen|prasad)/.test(t)) return /(broken|leak|fix|repair)/.test(t) ? 'maintenance' : 'cook'
  if (/(broken|lock|door|leak|tap|light|electric|bulb|repair|fix|flicker)/.test(t)) return 'maintenance'
  if (/(dirty|clean|bin|spill|mess)/.test(t)) return 'cleaner'
  if (/(ghee|camphor|flower|supply|supplies|stock|low on|run out|running low)/.test(t)) return 'caretaker'
  if (/(cctv|alarm|security|gate|stranger)/.test(t)) return 'security'
  return 'maintenance'
}

export function suggestedTitle(text: string): string {
  const t = text.toLowerCase()
  if (/lock/.test(t) && /broken/.test(t)) return 'Repair the broken lock'
  if (/(ghee|camphor|flower|supplies|stock|running low|low on)/.test(t)) return 'Buy and restock supplies'
  const clean = text.replace(/\s+/g, ' ').trim()
  return 'Follow up: ' + (clean.length > 50 ? clean.slice(0, 50) + '…' : clean)
}

// Deadlines are optional ("any time"). Sort those last, and never call them late.
export const dueMs = (t: Pick<Task, 'due_at'>) => (t.due_at ? new Date(t.due_at).getTime() : Number.POSITIVE_INFINITY)
export const byDue = (a: Pick<Task, 'due_at'>, b: Pick<Task, 'due_at'>) => dueMs(a) - dueMs(b)
// "16:30" (24-hour, as in the designs), or "Any time"
export const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Any time')
