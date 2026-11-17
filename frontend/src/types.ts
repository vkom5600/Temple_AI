// Shapes returned by the backend API. Field names match the database (snake_case).

export type Role = 'chairman' | 'committee' | 'staff' | 'volunteer'

export type Designation = 'priest' | 'cook' | 'cleaner' | 'caretaker' | 'security' | 'maintenance'

export interface AuthUser {
  id: number
  full_name: string
  email: string
  role: Role
  phone: string | null
  designation: Designation | null
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface User extends AuthUser {
  is_active: boolean
  approval_status: ApprovalStatus
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  emergency_contact: string | null
  joining_date: string | null
}

export interface UserInput {
  full_name: string
  email: string
  role: Exclude<Role, 'chairman'>
  phone: string
  designation: Designation | ''
  emergency_contact: string
  joining_date: string
  password?: string
}

export interface AppNotification {
  id: number
  title: string
  message: string | null
  notification_type: string
  is_read: boolean
  created_at: string
}

export interface RegisterInput {
  full_name: string
  email: string
  phone: string
  password: string
  role: Exclude<Role, 'chairman'>
  designation: Designation | ''
}

export interface Setting {
  key: 'registration_open' | 'login_alert_to_chairman' | 'closing_time'
  value: boolean | string
  label: string
  updated_at: string
}

// ---------- Phase 2: tasks + issues ----------

export type TaskGroup = Designation | 'staff' | 'volunteer' | 'committee'
export type TaskStatus = 'todo' | 'awaiting_signoff' | 'done' | 'flagged' | 'cancelled'
export type Priority = 'low' | 'normal' | 'high'
export type Recurrence = 'none' | 'daily' | 'weekly'

export interface Task {
  id: number
  title: string
  description: string | null
  category: string
  area: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  assigned_group: TaskGroup | null
  priority: Priority
  requires_verification: boolean
  status: TaskStatus
  due_at: string | null // null = no deadline ("any time")
  recurrence: Recurrence
  series_id: number | null
  completed_by: number | null
  completed_by_name: string | null
  completed_at: string | null
  verified_by: number | null
  verified_by_name: string | null
  verified_at: string | null
  last_reminded_at: string | null
  reminder_count: number
  created_by: number | null
  created_by_name: string | null
  created_at: string
  is_overdue: boolean
  last_comment: string | null
  last_comment_type: TaskComment['comment_type'] | null
  comment_count: number
}

export interface TaskComment {
  id: number
  comment: string
  comment_type: 'comment' | 'sent_back' | 'flagged' | 'system'
  created_at: string
  user_id: number | null
  user_name: string | null
}

export interface TaskInput {
  title: string
  description: string
  category: string
  area: string
  assigned_to: number | null
  assigned_group: TaskGroup | null
  priority: Priority
  requires_verification: boolean
  due_at: string | null
  recurrence: Recurrence
}

export interface TaskSummary {
  today_total: number
  today_done: number
  overdue: number
  awaiting_signoff: number
  flagged: number
  open_issues: number
  pending_registrations: number
}

export type TaskView = 'open' | 'overdue' | 'signoff' | 'flagged' | 'done' | 'all' | 'today' | 'mine'

export interface Issue {
  id: number
  reported_by: number | null
  reported_by_name: string | null
  task_id: number | null
  task_title: string | null
  task_status: TaskStatus | null
  category: string
  description: string
  status: 'open' | 'resolved' | 'converted'
  resolved_by_name: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_task_id: number | null
  created_task_title: string | null
  created_task_group: TaskGroup | null
  created_task_assignee_name: string | null
  created_at: string
}

// ---------- Phase 2: attendance ----------

export type ClosingChecks = { lamps: boolean; gas: boolean; doors: boolean }

export interface AttendanceRecord {
  id: number
  attendance_date: string
  status: 'present' | 'absent'
  check_in: string | null
  check_out: string | null
  closing_checks: ClosingChecks | null
  closing_confirmed_at: string | null
  closing_skipped: boolean
  notes: string | null
}

export interface MyAttendance {
  today: AttendanceRecord | null
  on_site: boolean
  last_one_here: boolean
  can_undo: boolean
  closing_items: Record<keyof ClosingChecks, string>
  history: Pick<AttendanceRecord, 'attendance_date' | 'status' | 'check_in' | 'check_out'>[]
}

export type PresenceState = 'here' | 'left' | 'not_in' | 'absent'

export interface PresenceRow {
  user_id: number
  full_name: string
  role: Role
  designation: Designation | null
  id: number | null
  status: AttendanceRecord['status'] | null
  check_in: string | null
  check_out: string | null
  notes: string | null
  closing_confirmed_at: string | null
  closing_skipped: boolean | null
  updated_by_name: string | null
  state: PresenceState
}

export interface AttendanceDay {
  date: string
  people: PresenceRow[]
  counts: Record<PresenceState, number>
  gaps: TaskGroup[]
  closing: { by: string; at: string; confirmed: boolean; checks: ClosingChecks | null } | null
}

export interface AttendanceInput {
  status: 'present' | 'absent'
  check_in: string | null
  check_out: string | null
  notes: string
}

// ---------- Broadcast (H3) and Activity log (R2) ----------

export type BroadcastAudience = 'everyone' | 'staff' | 'volunteer' | 'committee'

export interface AuditEntry {
  id: number
  actor_id: number | null
  actor_name: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  details: Record<string, unknown>
  created_at: string
  task_title: string | null
  target_name: string | null
  attendance_name: string | null
  issue_text: string | null
}
