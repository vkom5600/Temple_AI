import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/endpoints'
import { AVAILABILITY_LABELS, DESIGNATION_LABELS, HELP_LABELS, homePath } from '../constants'
import { ErrorNote, Icon, Modal, Spinner, type IconName } from '../components/ui'
import EntryShell from '../components/EntryShell'
import type { Designation, RegisterInput, SignupAvailability, SignupHelp } from '../types'

const BLANK: RegisterInput = { full_name: '', email: '', phone: '', password: '', role: 'volunteer', designation: '', availability: [], help: [], agree_rules: false }
const toggle = <T,>(list: T[] | undefined, item: T): T[] => (list ?? []).includes(item) ? (list ?? []).filter((x) => x !== item) : [...(list ?? []), item]

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
  const [roles, setRoles] = useState<RegisterInput['role'][]>(['volunteer', 'staff', 'committee'])
  const [nextOpens, setNextOpens] = useState<string | null>(null)
  const [closes, setCloses] = useState<string | null>(null)
  const [form, setForm] = useState<RegisterInput>(BLANK)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [showRules, setShowRules] = useState(false)
  const set = <K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    authApi.registrationStatus().then((r) => {
      setOpen(r.open)
      setNextOpens(r.next_opens)
      setCloses(r.closes)
      if (r.roles?.length) {
        setRoles(r.roles)
        // Start on a group that's actually open (P4: e.g. only volunteers this time)
        setForm((f) => (r.roles.includes(f.role) ? f : { ...f, role: r.roles[0] }))
      }
    }).catch(() => setOpen(true))
  }, [])

  if (user) return <Navigate to={homePath(user)} replace />

  const mismatch = confirm !== '' && confirm !== form.password
  const canSubmit =
    form.full_name.trim() && form.phone.trim() && form.email.trim() && form.password.length >= 8 &&
    confirm === form.password && (form.role !== 'staff' || form.designation) && form.agree_rules && !busy

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
          <h1>Registration closed</h1>
          <p className="lead" style={{ margin: 0 }}>
            {nextOpens
              ? `Sign-ups are closed right now. The next window opens ${new Date(`${nextOpens}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
              : 'Sign-ups are closed right now. Please contact the temple office.'}
          </p>
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
          <span className="pill pill-grn open-pill"><span className="dot" /> Sign-ups open{closes ? ` until ${new Date(`${closes}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</span>
          <p className="lead">Tell us a little about you. The committee checks every sign-up, and you can sign in once it's approved.</p>
          <form className="stack" onSubmit={submit} noValidate>
            <fieldset className="join-as">
              <legend className="label">I'm joining as</legend>
              {JOIN_AS.filter((o) => roles.includes(o.role)).map((o) => (
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

            <section className="jcard">
              <h2><Icon name="user" size={17} /> Your contact details</h2>
              <label className="field">
                <span className="label">Full name <i className="req">*</i></span>
                <input autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="e.g. Priyesh Patel" />
              </label>
              <label className="field">
                <span className="label">Mobile phone <i className="req">*</i></span>
                <span className="ifield"><Icon name="phone" /><input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7700 900456" /></span>
              </label>
              <label className="field">
                <span className="label">Email <span className="muted">(you'll sign in with this)</span></span>
                <span className="ifield"><Icon name="mail" /><input type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="e.g. priyesh@example.co.uk" /></span>
              </label>
              <div className="grid-2f">
                <label className="field">
                  <span className="label">Password <span className="muted">(8+)</span></span>
                  <span className="ifield"><Icon name="key" /><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} /></span>
                </label>
                <label className="field">
                  <span className="label">Confirm</span>
                  <span className="ifield"><Icon name="key" /><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></span>
                </label>
              </div>
              {mismatch && <span className="red small">Passwords don't match.</span>}
            </section>

            <section className="jcard">
              <h2><Icon name="calendar" size={17} /> When can you come?</h2>
              <div className="jchips" role="group" aria-label="When can you come?">
                {(Object.keys(AVAILABILITY_LABELS) as SignupAvailability[]).map((k) => (
                  <button key={k} type="button" className={`jchip ${form.availability?.includes(k) ? 'on' : ''}`} aria-pressed={!!form.availability?.includes(k)} onClick={() => setForm((f) => ({ ...f, availability: toggle(f.availability, k) }))}>
                    {form.availability?.includes(k) && <Icon name="check" size={14} />} {AVAILABILITY_LABELS[k]}
                  </button>
                ))}
              </div>
            </section>

            {form.role === 'volunteer' && (
              <section className="jcard">
                <h2><Icon name="heart" size={17} /> How would you like to help?</h2>
                <div className="jchips" role="group" aria-label="How would you like to help?">
                  {(Object.keys(HELP_LABELS) as SignupHelp[]).map((k) => (
                    <button key={k} type="button" className={`jchip ${form.help?.includes(k) ? 'on' : ''}`} aria-pressed={!!form.help?.includes(k)} onClick={() => setForm((f) => ({ ...f, help: toggle(f.help, k) }))}>
                      {form.help?.includes(k) && <Icon name="check" size={14} />} {HELP_LABELS[k]}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="jcard jrules">
              <label className="pcheck">
                <input type="checkbox" checked={!!form.agree_rules} onChange={(e) => set('agree_rules', e.target.checked)} />
                <span className="box" aria-hidden="true"><Icon name="check" size={14} /></span>
                <span><b>I'll follow the <button type="button" className="link-btn saf" onClick={(e) => { e.preventDefault(); setShowRules(true) }}>Temple Rules</button></b>
                  <span className="muted small" style={{ display: 'block' }}>{form.role === 'volunteer' ? 'Volunteers have a short safety talk on their first visit.' : 'The committee goes through them with you when you start.'}</span></span>
              </label>
            </section>

            <ErrorNote>{error}</ErrorNote>
            <button className="btn btn-primary btn-big" disabled={!canSubmit}>
              {busy ? 'Sending…' : <>Send my details <Icon name="arrow-right" size={18} /></>}
            </button>
          </form>
          <p className="fine"><Icon name="lock" size={13} /> We only use your number and email to contact you about the temple.</p>
          <p className="fine">Already have an account? <Link to="/login">Sign in</Link></p>
        </>
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </EntryShell>
  )
}

// The Temple Rules, readable before agreeing (public list)
function RulesModal({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<{ text: string; category: string }[] | null>(null)
  useEffect(() => { authApi.templeRules().then((r) => setRules(r.rules)).catch(() => setRules([])) }, [])
  const groups = [...new Set((rules ?? []).map((r) => r.category))]
  let n = 0
  return (
    <Modal title="Temple Rules" subtitle="Everyone who helps at the temple follows these." onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}>
      {!rules ? <Spinner /> : rules.length === 0 ? <p className="muted">The rules aren't available right now. Please ask the temple office.</p> : groups.map((g) => (
        <section key={g} className="dsec" style={{ marginBottom: 14 }}>
          <span className="ulabel">{g}</span>
          <ol className="rules-list" start={n + 1}>{rules.filter((r) => r.category === g).map((r) => { n++; return <li key={n}>{r.text}</li> })}</ol>
        </section>
      ))}
    </Modal>
  )
}
