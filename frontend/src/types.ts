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
  key: 'registration_open' | 'login_alert_to_chairman'
  value: boolean
  label: string
  updated_at: string
}
