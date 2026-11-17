import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { homePath } from '../constants'
import { ErrorNote } from '../components/ui'
import EntryShell from '../components/EntryShell'

// Shown only in development (npm run dev) so each role can be tried quickly.
const DEMO_ACCOUNTS = [
  { email: 'raghu@temple.demo', who: 'Raghu · Chairman' },
  { email: 'meena@temple.demo', who: 'Meena · Committee' },
  { email: 'ramesh@temple.demo', who: 'Ramesh · Staff (cleaner)' },
  { email: 'priya@temple.demo', who: 'Priya · Volunteer' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homePath(user)} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const me = await login(email, password)
      const from = (location.state as { from?: string } | null)?.from
      const home = homePath(me)
      navigate(from?.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <EntryShell>
      <div className="panel entry-card">
        <h1>Sign in</h1>
        <p className="muted">Use the email and password for your account.</p>
        <form className="stack" onSubmit={submit} noValidate>
          <label className="field">
            <span className="label">Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <p className="muted small center entry-foot">New here? <Link to="/register">Register to join the team</Link></p>
      {import.meta.env.DEV && (
        <section className="demo-accounts">
          <h2 className="eyebrow">Demo accounts (development only)</h2>
          <p className="muted small">Password is DEMO_PASSWORD from backend/.env.</p>
          <div className="chips">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" className="chip" onClick={() => setEmail(a.email)}>{a.who}</button>
            ))}
          </div>
        </section>
      )}
    </EntryShell>
  )
}
