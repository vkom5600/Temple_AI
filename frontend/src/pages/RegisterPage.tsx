import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/endpoints'
import { DESIGNATION_LABELS, homePath } from '../constants'
import { ErrorNote, Icon, Spinner } from '../components/ui'
import type { Designation, RegisterInput } from '../types'

const BLANK: RegisterInput = { full_name: '', email: '', phone: '', password: '', role: 'volunteer', designation: '' }

const JOIN_AS: { role: RegisterInput['role']; label: string; hint: string }[] = [
  { role: 'volunteer', label: 'Volunteer', hint: 'Help at festivals, events and daily seva' },
  { role: 'staff', label: 'Staff', hint: 'Priest, cook, cleaner, caretaker, security or maintenance' },
  { role: 'committee', label: 'Committee', hint: 'Temple management committee members' },
]

// Self-registration (sequence diagram: User Registration and Chairman Approval).
// The account stays pending until the chairman approves it.
export default function RegisterPage() {
  const { user } = useAuth()
  const [open, setOpen] = useState<boolean | null>(null)
  const [form, setForm] = useState<RegisterInput>(BLANK)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const set = <K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    authApi.registrationStatus().then((r) => setOpen(r.open)).catch(() => setOpen(true))
  }, [])

  if (user) return <Navigate to={homePath(user)} replace />

  const mismatch = confirm !== '' && confirm !== form.password
  const canSubmit =
    form.full_name.trim() && form.email.trim() && form.password.length >= 8 &&
    confirm === form.password && (form.role !== 'staff' || form.designation) && !busy

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await authApi.register(form)
      setDone(r.message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-inner login-narrow">
        <div className="brand">
          <span className="brand-mark">ॐ</span>
          <div>
            <div className="brand-name">Temple AI</div>
            <div className="brand-sub">Daily operations</div>
          </div>
        </div>

        <h1 className="login-title">Join the team</h1>

        {open === null && <Spinner />}

        {open === false && (
          <div className="panel stack">
            <p>Registration is closed at the moment. Please contact the temple office.</p>
            <Link to="/login" className="btn btn-ghost btn-block">Back to sign in</Link>
          </div>
        )}

        {open && done && (
          <div className="panel stack" role="status">
            <div className="notice"><Icon name="check" /><div>{done}</div></div>
            <Link to="/login" className="btn btn-primary btn-block">Back to sign in</Link>
          </div>
        )}

        {open && !done && (
          <>
            <p className="muted">The chairman reviews every registration. You can sign in once it's approved.</p>
            <form className="panel stack" onSubmit={submit} noValidate>
              <fieldset className="join-as">
                <legend className="label">I'd like to join as</legend>
                {JOIN_AS.map((o) => (
                  <label key={o.role} className={`join-option ${form.role === o.role ? 'on' : ''}`}>
                    <input type="radio" name="role" value={o.role} checked={form.role === o.role} onChange={() => set('role', o.role)} />
                    <span>
                      <span className="strong">{o.label}</span>
                      <span className="muted small block">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {form.role === 'staff' && (
                <label className="field">
                  <span className="label">Your job</span>
                  <select value={form.designation} onChange={(e) => set('designation', e.target.value as Designation | '')}>
                    <option value="">Choose…</option>
                    {Object.entries(DESIGNATION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
              )}

              <label className="field">
                <span className="label">Full name</span>
                <input autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Mobile <span className="muted">(optional)</span></span>
                <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7…" />
              </label>
              <label className="field">
                <span className="label">Password <span className="muted">(8+ characters)</span></span>
                <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Confirm password</span>
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {mismatch && <span className="red small">Passwords don't match.</span>}
              </label>

              <ErrorNote>{error}</ErrorNote>
              <button className="btn btn-primary btn-lg btn-block" disabled={!canSubmit}>
                {busy ? 'Sending…' : 'Register'}
              </button>
            </form>
            <p className="muted small center">Already have an account? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
