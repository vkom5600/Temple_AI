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
  access?: Access | null // committee per-area access (P2); null for staff and volunteers
}

export type AccessArea = 'tasks' | 'calendar' | 'people' | 'rules' | 'reports'
export interface Access {
  tasks: 'off' | 'view' | 'manage'
  calendar: 'off' | 'view' | 'manage'
  people: 'off' | 'view' | 'manage'
  rules: 'off' | 'view' | 'manage'
  reports: 'off' | 'view'
  broadcast: boolean
  ai: boolean
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
  signup_details?: SignupDetails | null
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
  availability?: SignupAvailability[]
  help?: SignupHelp[]
  agree_rules?: boolean
}

// W2 sign-up answers (shown in the P5 review and on P2)
export type SignupAvailability = 'weekday_mornings' | 'weekday_evenings' | 'weekends' | 'festivals'
export type SignupHelp = 'kitchen' | 'cleaning' | 'setting_up' | 'parking' | 'puja' | 'anything'
export interface SignupDetails { availability: SignupAvailability[]; help: SignupHelp[]; rules_agreed_at?: string }

export interface Setting {
  key: 'registration_open' | 'login_alert_to_chairman' | 'closing_time' | 'auto_reminders' | 'nightly_report'
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
  booking_id?: number | null // prep task for a booking (Phase 3)
  series_id: number | null
  completed_by: number | null
  completed_by_name: string | null
  completed_at: string | null
  verified_by: number | null
  verified_by_name: string | null
  verified_at: string | null
  last_reminded_at: string | null
  last_reminded_by_name?: string | null
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
  pending_bookings: number
  open_questions?: number
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

// ---------- Phase 3: bookings ----------

export type ResourceKind = 'hall' | 'room' | 'mandir' | 'kitchen' | 'space' | 'other'

export interface Resource {
  id: number
  name: string
  kind: ResourceKind
  capacity: number | null
  notes: string | null
  is_active: boolean
  sort_order: number
}

export interface TempleRule {
  id: number
  category: string
  text: string
  ask_requester: boolean
  is_active: boolean
  sort_order: number
  updated_by_name?: string | null
  updated_at: string
}

export type BookingStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export interface Booking {
  id: number
  resource_id: number
  resource_name: string
  resource_kind: ResourceKind
  resource_capacity: number | null
  kind: 'booking' | 'event'
  title: string
  starts_at: string
  ends_at: string
  guests: number | null
  food: boolean
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  organisation: string | null
  notes: string | null
  deposit_paid: boolean
  status: BookingStatus
  source: 'mobile' | 'desk' | 'web'
  ai_note?: string | null // AC2: Temple AI's short note on a pending request (with a Claude key)
  requested_by: number | null
  requested_by_name: string | null
  rules_agreed: number[]
  rules_agreed_at: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  decision_note: string | null
  task_count: number
  created_at: string
}

export interface BookingCheck {
  recommendation: 'approve' | 'decline'
  summary: string
  problems: string[]
  clashes: { id: number; title: string; starts_at: string; ends_at: string }[]
  rules_total: number
  rules_agreed: number
  free: boolean
}

export interface BookingDetail {
  booking: Booking
  rules: (Pick<TempleRule, 'id' | 'text'> & { agreed: boolean })[]
  check?: BookingCheck
  prep_tasks?: { title: string; assigned_group: TaskGroup; due_at: string; requires_verification: boolean }[]
  tasks?: { id: number; title: string; status: TaskStatus; assigned_group: TaskGroup | null; assigned_to_name?: string | null; due_at: string | null }[]
}

export interface BookingInput {
  resource_id: number
  kind?: 'booking' | 'event'
  title: string
  starts_at: string
  ends_at: string
  guests: number | null
  food: boolean
  contact_name: string
  contact_phone: string
  contact_email?: string
  organisation?: string
  notes?: string
  deposit_paid?: boolean
  rules_agreed?: number[]
  notify_staff?: boolean
}

export interface ScheduleItem {
  id: number
  kind: 'booking' | 'event'
  title: string
  starts_at: string
  ends_at: string
  resource_name: string
}

// ---------- Phase 3: Plan with AI (AI2) ----------

export interface PlanTask {
  title: string
  assigned_to: number | null
  assigned_to_name?: string | null
  assigned_group: TaskGroup | null
  due_at: string
  category: string
  requires_verification: boolean
  added?: boolean
  change?: string | null // plan from last time: what changed ("Updated from 200 to 250 people")
}

export interface PlanEvent {
  title: string
  resource_id: number
  resource_name: string
  resource_capacity: number | null
  starts_at: string
  ends_at: string
  guests: number | null
  kind: string
}

export interface PlanNote { tone: 'warn' | 'idea'; text: string }

export interface PlanDraft {
  event: PlanEvent
  tasks: PlanTask[]
  notes: PlanNote[]
  based_on: { id: number; title: string; starts_at: string; tasks: number } | null
}

// ---------- P4 sign-up window ----------

export type SignupRole = 'volunteer' | 'staff' | 'committee'

export interface SignupWindow {
  switched_on: boolean
  open: boolean
  roles: SignupRole[]
  opens: string | null
  closes: string | null
  next_opens: string | null
  reason: 'off' | 'no_roles' | 'not_yet' | 'ended' | null
}

// ---------- Phase 4: festival days (H2) ----------

export interface Festival {
  id: number
  name: string
  subtitle: string | null
  date: string // YYYY-MM-DD
  kind: 'festival' | 'observance'
  opens: string | null
  closes: string | null
  confirmed: boolean
  remind: boolean
  snoozed_until: string | null
}

export interface FestivalHome {
  today: Festival[]
  next: Festival | null
  reminder: { festival: Festival; days: number; last_time: { id: number; title: string; tasks: number; volunteers: number } | null } | null
  events_today: number
}

// ---------- M6 Ask a question ----------
export interface Question {
  id: number
  question: string
  answer: string | null
  created_at: string
  answered_at: string | null
  seen_at: string | null
  task_id: number | null
  task_title: string | null
  asked_by: number
  asked_by_name: string
  asked_by_designation: Designation | null
  asked_by_role: Role
  answered_by_name: string | null
}
