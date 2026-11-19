import { api } from './client'
import type {
  PlanDraft,
  PlanEvent,
  PlanTask,
  SignupRole,
  SignupWindow,
  AttendanceDay, AttendanceInput, AuditEntry, Booking, BookingDetail, BookingInput, BroadcastAudience, ClosingChecks, MyAttendance,
  Resource, ScheduleItem, TempleRule,
  AppNotification, AuthUser, Issue, RegisterInput, Setting, Task, TaskComment, TaskInput, TaskSummary, TaskView, User, UserInput,
} from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: { email, password } }),
  profile: () => api<{ user: AuthUser }>('/auth/profile'),
  registrationStatus: () => api<{ open: boolean; roles: SignupRole[]; next_opens: string | null; closes: string | null }>('/auth/registration-status'),
  register: (input: RegisterInput) => api<{ message: string }>('/auth/register', { method: 'POST', body: input }),
}

export const usersApi = {
  list: () => api<{ users: User[] }>('/users'),
  create: (input: UserInput) => api<{ user: User }>('/users', { method: 'POST', body: input }),
  update: (id: number, input: UserInput) => api<{ user: User }>(`/users/${id}`, { method: 'PUT', body: input }),
  setActive: (id: number, active: boolean) =>
    api<{ user: User }>(`/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' }),
  approve: (id: number) => api<{ user: User; message: string }>(`/users/${id}/approve`, { method: 'PATCH' }),
  remove: (id: number) => api<{ message: string; open_tasks: number }>(`/users/${id}`, { method: 'DELETE' }),
  reject: (id: number, reason: string) =>
    api<{ user: User; message: string }>(`/users/${id}/reject`, { method: 'PATCH', body: { reason } }),
}

export const settingsApi = {
  list: () => api<{ settings: Setting[] }>('/settings'),
  update: (key: Setting['key'], value: boolean | string) =>
    api<{ settings: Setting[] }>(`/settings/${key}`, { method: 'PUT', body: { value } }),
  // P4 sign-up window
  signupWindow: () => api<{ window: SignupWindow; pending: number }>('/settings/signup-window'),
  saveSignupWindow: (input: { open: boolean; roles: SignupRole[]; opens: string | null; closes: string | null }) =>
    api<{ window: SignupWindow; message: string }>('/settings/signup-window', { method: 'PUT', body: input }),
}

export const notificationsApi = {
  list: () => api<{ notifications: AppNotification[] }>('/notifications'),
  unreadCount: () => api<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (id: number) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api('/notifications/read-all', { method: 'PATCH' }),
  // H3 Broadcast (chairman, committee)
  broadcast: (input: { audience: BroadcastAudience; designations: string[]; message: string; urgent: boolean }) =>
    api<{ count: number; message: string }>('/notifications/broadcast', { method: 'POST', body: input }),
}

// R2 Activity log (chairman, committee)
export const auditApi = {
  list: (params: { entity_type?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
    return api<{ auditLogs: AuditEntry[]; count: number }>(`/audit-logs${query ? `?${query}` : ''}`)
  },
}

type TaskResult = { task: Task; message: string }

export const tasksApi = {
  list: (params: { view?: TaskView; group?: string; category?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
    return api<{ tasks: Task[] }>(`/tasks${query ? `?${query}` : ''}`)
  },
  summary: () => api<{ summary: TaskSummary }>('/tasks/summary'),
  signoffs: () => api<{ tasks: Task[] }>('/tasks/signoffs'),
  get: (id: number) => api<{ task: Task; comments: TaskComment[] }>(`/tasks/${id}`),
  create: (tasks: TaskInput[]) => api<{ tasks: Task[]; message: string }>('/tasks', { method: 'POST', body: { tasks } }),
  update: (id: number, input: TaskInput) => api<TaskResult>(`/tasks/${id}`, { method: 'PUT', body: input }),
  complete: (id: number, note?: string) => api<TaskResult>(`/tasks/${id}/complete`, { method: 'PATCH', body: { note } }),
  undo: (id: number) => api<TaskResult>(`/tasks/${id}/undo`, { method: 'PATCH' }),
  verify: (id: number) => api<TaskResult>(`/tasks/${id}/verify`, { method: 'PATCH' }),
  sendBack: (id: number, note: string) => api<TaskResult>(`/tasks/${id}/send-back`, { method: 'PATCH', body: { note } }),
  flag: (id: number, category: string, description: string) =>
    api<TaskResult>(`/tasks/${id}/flag`, { method: 'PATCH', body: { category, description } }),
  reopen: (id: number) => api<TaskResult>(`/tasks/${id}/reopen`, { method: 'PATCH' }),
  cancel: (id: number, stopRepeating = false) =>
    api<TaskResult>(`/tasks/${id}/cancel`, { method: 'PATCH', body: { stop_repeating: stopRepeating } }),
  remind: (id: number) => api<TaskResult>(`/tasks/${id}/remind`, { method: 'POST' }),
  comment: (id: number, comment: string) => api<{ message: string }>(`/tasks/${id}/comments`, { method: 'POST', body: { comment } }),
}

export const issuesApi = {
  list: (status: 'open' | 'handled') => api<{ issues: Issue[] }>(`/issues?status=${status}`),
  report: (category: string, description: string) =>
    api<{ issue: Issue; message: string }>('/issues', { method: 'POST', body: { category, description } }),
  resolve: (id: number, note: string) => api<{ issue: Issue; message: string }>(`/issues/${id}/resolve`, { method: 'PATCH', body: { note } }),
  convert: (id: number, task: TaskInput) =>
    api<{ issue: Issue; task: Task; message: string }>(`/issues/${id}/convert`, { method: 'POST', body: task }),
}

type Mine = MyAttendance & { message: string }

export const attendanceApi = {
  me: () => api<MyAttendance>('/attendance/me'),
  checkIn: () => api<Mine>('/attendance/check-in', { method: 'POST' }),
  undoCheckIn: () => api<Mine>('/attendance/undo-check-in', { method: 'POST' }),
  leave: (closing?: Partial<ClosingChecks>) => api<Mine>('/attendance/leave', { method: 'POST', body: { closing } }),
  back: () => api<Mine>('/attendance/back', { method: 'POST' }),
  day: (date?: string) => api<AttendanceDay>(`/attendance${date ? `?date=${date}` : ''}`),
  save: (userId: number, date: string, input: AttendanceInput) =>
    api<{ message: string }>(`/attendance/${userId}/${date}`, { method: 'PUT', body: input }),
  remove: (userId: number, date: string) => api<{ message: string }>(`/attendance/${userId}/${date}`, { method: 'DELETE' }),
}

// ---------- Phase 3: bookings, halls and rooms, Temple Rules ----------

type BookingResult = { booking: Booking; message: string }

export const bookingsApi = {
  list: (params: { from?: string; to?: string; status?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
    return api<{ bookings: Booking[] }>(`/bookings${query ? `?${query}` : ''}`)
  },
  schedule: (date?: string) => api<{ bookings: ScheduleItem[] }>(`/bookings/schedule${date ? `?date=${date}` : ''}`),
  get: (id: number) => api<BookingDetail>(`/bookings/${id}`),
  check: (input: { resource_id: number; starts_at: string; ends_at: string; guests?: number | null }) =>
    api<{ free: boolean; clashes: { title: string; starts_at: string; ends_at: string }[]; problems: string[] }>('/bookings/check', { method: 'POST', body: input }),
  create: (input: BookingInput) => api<BookingResult>('/bookings', { method: 'POST', body: input }),
  approve: (id: number, createTasks = true) => api<BookingResult>(`/bookings/${id}/approve`, { method: 'PATCH', body: { create_tasks: createTasks } }),
  decline: (id: number, reason: string) => api<BookingResult>(`/bookings/${id}/decline`, { method: 'PATCH', body: { reason } }),
  cancel: (id: number, reason?: string) => api<BookingResult>(`/bookings/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  ask: (id: number, question: string) => api<{ message: string }>(`/bookings/${id}/ask`, { method: 'POST', body: { question } }),
}

export const resourcesApi = {
  list: (all = false) => api<{ resources: Resource[] }>(`/resources${all ? '?all=1' : ''}`),
  create: (input: Partial<Resource>) => api<{ resource: Resource; message: string }>('/resources', { method: 'POST', body: input }),
  update: (id: number, input: Partial<Resource>) => api<{ resource: Resource; message: string }>(`/resources/${id}`, { method: 'PUT', body: input }),
}

export const rulesApi = {
  list: (all = false) => api<{ rules: TempleRule[] }>(`/rules${all ? '?all=1' : ''}`),
  create: (input: Partial<TempleRule>) => api<{ rule: TempleRule; message: string }>('/rules', { method: 'POST', body: input }),
  update: (id: number, input: Partial<TempleRule>) => api<{ rule: TempleRule; message: string }>(`/rules/${id}`, { method: 'PUT', body: input }),
}

// AI2 Plan with AI: draft from the conversation, then confirm (event + tasks)
export const plansApi = {
  draft: (messages: string[], asked: string[]) =>
    api<{ reply: string; ask?: string; draft?: PlanDraft }>('/plans/draft', { method: 'POST', body: { messages, asked } }),
  confirm: (event: PlanEvent, tasks: PlanTask[]) =>
    api<{ message: string; tasks: number }>('/plans/confirm', { method: 'POST', body: { event, tasks } }),
}
