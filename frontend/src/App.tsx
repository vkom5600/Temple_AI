import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import RequireRole from './auth/RequireRole'
import { ToastProvider } from './components/Toast'
import { Spinner } from './components/ui'
import { homePath } from './constants'
import AdminLayout from './layouts/AdminLayout'
import StaffLayout from './layouts/StaffLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/admin/SettingsPage'
import AdminHome from './pages/admin/AdminHome'
import ActionCenterPage from './pages/admin/ActionCenterPage'
import CalendarPage from './pages/admin/CalendarPage'
import ReportsPage from './pages/admin/ReportsPage'
import PeoplePage from './pages/admin/PeoplePage'
import TasksPage from './pages/admin/TasksPage'
import IssuesPage from './pages/admin/IssuesPage'
import SignoffsPage from './pages/admin/SignoffsPage'
import WhosOnPage from './pages/admin/WhosOnPage'
import StaffHome from './pages/staff/StaffHome'
import BookPage from './pages/staff/BookPage'
import MyBookingsPage from './pages/staff/MyBookingsPage'
import RulesPage from './pages/admin/RulesPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/join" element={<RegisterPage />} />
            <Route path="/book" element={<BookPage publicMode />} />

            <Route path="/admin" element={<RequireRole roles={['chairman', 'committee']}><AdminLayout /></RequireRole>}>
              <Route index element={<AdminHome />} />
              <Route path="action-center" element={<ActionCenterPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="rules" element={<RulesPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="issues" element={<IssuesPage />} />
              <Route path="signoffs" element={<SignoffsPage />} />
              <Route path="attendance" element={<WhosOnPage />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="settings" element={<RequireRole roles={['chairman']}><SettingsPage /></RequireRole>} />
            </Route>

            <Route path="/staff" element={<RequireRole roles={['staff', 'volunteer']}><StaffLayout /></RequireRole>}>
              <Route index element={<StaffHome />} />
              <Route path="book" element={<BookPage />} />
              <Route path="bookings" element={<MyBookingsPage />} />
            </Route>

            <Route path="*" element={<GoHome />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

// "/" and unknown paths: go to your own home screen, or log in.
function GoHome() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return <Navigate to={user ? homePath(user) : '/login'} replace />
}
