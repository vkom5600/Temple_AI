import { api } from './client'
import type {
  AppNotification, AuthUser, Issue, RegisterInput, Setting, Task, TaskComment, TaskInput, TaskSummary, TaskView, User, UserInput,
} from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: { email, password } }),
  profile: () => api<{ user: AuthUser }>('/auth/profile'),
  registrationStatus: () => api<{ open: boolean }>('/auth/registration-status'),
  register: (input: RegisterInput) => api<{ message: string }>('/auth/register', { method: 'POST', body: input }),
}

export const usersApi = {
  list: () => api<{ users: User[] }>('/users'),
  create: (input: UserInput) => api<{ user: User }>('/users', { method: 'POST', body: input }),
  update: (id: number, input: UserInput) => api<{ user: User }>(`/users/${id}`, { method: 'PUT', body: input }),
  setActive: (id: number, active: boolean) =>
    api<{ user: User }>(`/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' }),
  approve: (id: number) => api<{ user: User; message: string }>(`/users/${id}/approve`, { method: 'PATCH' }),
  reject: (id: number, reason: string) =>
    api<{ user: User; message: string }>(`/users/${id}/reject`, { method: 'PATCH', body: { reason } }),
}

export const settingsApi = {
  list: () => api<{ settings: Setting[] }>('/settings'),
  update: (key: Setting['key'], value: boolean) =>
    api<{ settings: Setting[] }>(`/settings/${key}`, { method: 'PUT', body: { value } }),
}

export const notificationsApi = {
  list: () => api<{ notifications: AppNotification[] }>('/notifications'),
  unreadCount: () => api<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (id: number) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api('/notifications/read-all', { method: 'PATCH' }),
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
