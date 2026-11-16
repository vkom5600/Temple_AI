import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { homePath } from '../constants'
import { Spinner } from '../components/ui'
import type { Role } from '../types'

// Route guard: sends logged-out people to /login and anyone in the wrong
// role to their own home screen. (The API enforces the same rules.)
export default function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={homePath(user)} replace />
  return <>{children}</>
}
