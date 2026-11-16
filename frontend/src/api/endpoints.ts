import { api } from './client'
import type { AppNotification, AuthUser, RegisterInput, Setting, User, UserInput } from '../types'

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
