import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/endpoints'
import { DESIGNATION_LABELS, homePath } from '../constants'
import { ErrorNote, Icon, Spinner, type IconName } from '../components/ui'
import EntryShell from '../components/EntryShell'
import type { Designation, RegisterInput } from '../types'

const BLANK: RegisterInput = { full_name: '', email: '', phone: '', password: '', role: 'volunteer', designation: '' }

const JOIN_AS: { role: RegisterInput['role']; label: string; hint: string; icon: IconName }[] = [
  { role: 'volunteer', label: 'Volunteer', hint: 'Help at festivals, events and daily seva', icon: 'heart' },
  { role: 'staff', label: 'Staff', hint: 'Priest, cook, cleaner, caretaker, security or maintenance', icon: 'badge' },
  { role: 'committee', label: 'Committee member', hint: 'Only if the chairman asked you to join', icon: 'users' },
]

// W2 Join the temple team, W3 Thank you / Sign-ups closed (designs: screens/44, 45, 46).
// Self-registration: the account stays pending until the chairman approves it.
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
    <EntryShell>
      {open === null && <Spinner />}

      {open === false && (
        <div className="stack center" style={{ paddingTop: 24 }}>
          <span className="tile-ic ic-ind" style={{ margin: '0 auto' }}><Icon name="lock" size={22} /></span>
          <h1>Sign-ups are closed</h1>
          <p className="lead" style={{ margin: 0 }}>Registration is closed right now. Please contact the temple office.</p>
          <Link to="/login" className="btn btn-outline btn-big">Back to sign in</Link>
        </div>
      )}

      {open && done && (
        <div className="stack center" role="status" style={{ paddingTop: 24 }}>
          <span className="tile-ic ic-grn" style={{ margin: '0 auto', width: 64, height: 64, borderRadius: '50%' }}><Icon name="check" size={30} /></span>
          <h1>Thank you, {form.full_name.split(' ')[0]}!</h1>
          <p className="lead" style={{ margin: 0 }}>{done}</p>
          <Link to="/login" className="btn btn-outline btn-big"><Icon name="arrow-right" /> Back to sign in</Link>
        </div>
      )}

      {open && !done && (
        <>
          <h1>Join the temple team</h1>
          <p className="lead">Tell us a little about you. The chairman checks every sign-up, and you can sign in once it's approved.</p>
          <span className="pill pill-grn open-pill"><span className="dot" /> Sign-ups are open</span>
          <form className="stack" onSubmit={submit} noValidate>
            <fieldset className="join-as">
              <legend className="label">I'm joining as</legend>
              {JOIN_AS.map((o) => (
                <label key={o.role} className={`choice ${form.role === o.role ? 'on' : ''}`}>
                  <input type="radio" name="role" value={o.role} checked={form.role === o.role} onChange={() => set('role', o.role)} />
                  <span className="ic"><Icon name={o.icon} size={22} /></span>
                  <span className="txt"><b>{o.label}</b><span>{o.hint}</span></span>
                  <span className="radio" aria-hidden="true" />
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
              <span className="ifield"><Icon name="user" /><input autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></span>
            </label>
            <label className="field">
              <span className="label">Mobile phone <span className="muted">(optional)</span></span>
              <span className="ifield"><Icon name="phone" /><input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7…" /></span>
            </label>
            <label className="field">
              <span className="label">Email <span className="muted">(you'll sign in with this)</span></span>
              <span className="ifield"><Icon name="mail" /><input type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" /></span>
            </label>
            <label className="field">
              <span className="label">Password <span className="muted">(8+ characters)</span></span>
              <span className="ifield"><Icon name="key" /><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} /></span>
            </label>
            <label className="field">
              <span className="label">Confirm password</span>
              <span className="ifield"><Icon name="key" /><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></span>
              {mismatch && <span className="red small">Passwords don't match.</span>}
            </label>

            <ErrorNote>{error}</ErrorNote>
            <button className="btn btn-primary btn-big" disabled={!canSubmit}>
              {busy ? 'Sending…' : 'Send my details'}
            </button>
          </form>
          <p className="fine">We only use your details to contact you about the temple.</p>
          <p className="fine">Already have an account? <Link to="/login">Sign in</Link></p>
        </>
      )}
    </EntryShell>
  )
}
