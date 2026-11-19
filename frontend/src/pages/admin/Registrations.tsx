import { useEffect, useState } from 'react'
import { settingsApi, usersApi } from '../../api/endpoints'
import { AVAILABILITY_LABELS, DESIGNATION_LABELS, HELP_LABELS, ROLE_LABELS } from '../../constants'
import { timeAgo } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Modal, type IconName } from '../../components/ui'
import { BRAND } from '../../branding'
import { qrPath, qrPng } from '../../lib/qr'
import type { SignupRole, SignupWindow, User, SignupDetails } from '../../types'

// P1 "Volunteer registration" card + P4 Sign-up window (designs: screens/27_P1, P4_sign-up-window).
// The chairman opens sign-ups for chosen groups between two dates (they close by
// themselves), shares the link or a printable QR code, and reviews who signed up.

const ROLE_ROWS: { role: SignupRole; label: string; hint: string; icon: IconName }[] = [
  { role: 'volunteer', label: 'Volunteers', hint: 'Anyone with the link', icon: 'heart' },
  { role: 'staff', label: 'Staff', hint: 'Priest, cook, cleaner, caretaker, security', icon: 'badge' },
  { role: 'committee', label: 'Committee members', hint: 'Only people you invite', icon: 'shield' },
]
const ROLE_WORD: Record<SignupRole, string> = { volunteer: 'Volunteer', staff: 'Staff', committee: 'Committee' }
export const signupLink = () => `${window.location.origin}/join`
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })
const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })

const copyLink = async (toast: (m: string) => void) => {
  try { await navigator.clipboard.writeText(signupLink()); toast('Sign-up link copied') } catch { toast(signupLink()) }
}

export function SignupsCard({ pending, onReview }: { pending: User[]; onReview: () => void }) {
  const toast = useToast()
  const [win, setWin] = useState<SignupWindow | null>(null)
  const [editing, setEditing] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const load = () => settingsApi.signupWindow().then((r) => setWin(r.window)).catch(() => {})
  useEffect(() => { load() }, [])

  const toggle = async () => {
    if (!win) return
    try {
      const roles = win.roles.length ? win.roles : (['volunteer'] as SignupRole[])
      const r = await settingsApi.saveSignupWindow({ open: !win.switched_on, roles, opens: win.opens, closes: win.closes })
      setWin(r.window)
      toast(r.message)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  const who = win?.roles.length ? win.roles.map((r) => ROLE_WORD[r]).join(' and ').replace(/^(\w)/, (c) => c.toUpperCase()) : 'Volunteer'
  const state = !win ? null
    : win.open ? { text: 'Open', cls: 'state-open' }
    : win.reason === 'not_yet' ? { text: `Opens ${shortDay(win.opens!)}`, cls: 'state-soon' }
    : win.reason === 'ended' ? { text: 'Ended', cls: 'state-closed' }
    : { text: 'Closed', cls: 'state-closed' }
  const dates = !win ? '' : win.opens && win.closes ? `Open ${shortDay(win.opens)} – ${shortDay(win.closes)}`
    : win.closes ? `Open until ${shortDay(win.closes)}` : win.opens ? `From ${shortDay(win.opens)}, no end date` : 'No dates set'

  return (
    <section className="list-card reg-card">
      <div className="reg-top">
        <div className="grow">
          <h3>
            {who} registration
            {win && <button className={`switch ${win.switched_on ? 'on' : ''}`} role="switch" aria-checked={win.switched_on} aria-label="Sign-ups on" onClick={toggle}><span className="switch-knob" /></button>}
            {state && <span className={state.cls}>{state.text}</span>}
          </h3>
          <div className="muted">{dates} · <button className="link-btn saf" onClick={() => setEditing(true)}>Edit</button></div>
        </div>
        <div className="reg-actions">
          <button className="btn btn-outline" onClick={() => copyLink(toast)}><Icon name="copy" size={16} /> Copy sign-up link</button>
          <button className="btn btn-outline" onClick={() => setShowQr(true)}><Icon name="qr" size={16} /> Show QR code</button>
        </div>
      </div>
      <div className="reg-bottom">
        {pending.length > 0 ? (
          <>
            <span className="waiting-line"><span className="dot" /> {pending.length} new {pending.length === 1 ? 'person' : 'people'} waiting</span>
            <button className="link-btn saf" onClick={onReview}>Review <Icon name="arrow-right" size={14} /></button>
          </>
        ) : <span className="muted">Nobody waiting to be checked</span>}
      </div>
      {editing && win && <SignupWindowDialog win={win} pending={pending.length} onReview={() => { setEditing(false); onReview() }} onClose={() => setEditing(false)} onSaved={(w) => { setWin(w); setEditing(false) }} />}
      {showQr && <QrDialog onClose={() => setShowQr(false)} />}
    </section>
  )
}

// P4 Sign-up window
function SignupWindowDialog({ win, pending, onClose, onSaved, onReview }: { win: SignupWindow; pending: number; onClose: () => void; onSaved: (w: SignupWindow) => void; onReview: () => void }) {
  const toast = useToast()
  const [roles, setRoles] = useState<SignupRole[]>(win.roles)
  const [opens, setOpens] = useState(win.opens ?? '')
  const [closes, setCloses] = useState(win.closes ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const qr = qrPath(signupLink())

  const save = async (open: boolean) => {
    setError('')
    setBusy(true)
    try {
      const r = await settingsApi.saveSignupWindow({ open, roles, opens: opens || null, closes: closes || null })
      toast(r.message)
      onSaved(r.window)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const flip = (role: SignupRole) => setRoles((rs) => (rs.includes(role) ? rs.filter((r) => r !== role) : [...rs, role]))

  return (
    <Modal
      title="Sign-up window"
      subtitle="Let new people sign up from a link or QR code. Nothing happens until you approve them."
      onClose={onClose}
      footer={
        <>
          {win.switched_on && <button className="link-btn danger" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => save(false)}>Close sign-ups</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => save(true)}>{busy ? 'Saving…' : win.switched_on ? 'Save' : 'Save and open'}</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <section className="dsec">
          <span className="ulabel">Who can sign up</span>
          {ROLE_ROWS.map((r) => (
            <div key={r.role} className={`who-row ${roles.includes(r.role) ? 'on' : ''}`}>
              <span className="tile-ic ic-soft"><Icon name={r.icon} size={18} /></span>
              <div className="grow"><b>{r.label}</b><span className="muted small">{r.hint}</span></div>
              <button className={`switch ${roles.includes(r.role) ? 'on' : ''}`} role="switch" aria-checked={roles.includes(r.role)} aria-label={`${r.label} can sign up`} onClick={() => flip(r.role)}><span className="switch-knob" /></button>
            </div>
          ))}
        </section>

        <section className="dsec">
          <span className="ulabel">When</span>
          <div className="grid-2f">
            <label className="field"><span>Opens</span><input type="date" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
            <label className="field"><span>Closes</span><input type="date" value={closes} min={opens || undefined} onChange={(e) => setCloses(e.target.value)} /></label>
          </div>
          <span className="muted small">{closes ? `Closes by itself after ${longDay(closes)}. Turn it off any time.` : 'No closing date: stays open until you turn it off.'}{opens ? ` Opens ${longDay(opens)}.` : ''}</span>
        </section>

        <section className="dsec">
          <span className="ulabel">Share</span>
          <div className="share-row">
            <Icon name="link" size={18} />
            <b className="grow">{signupLink().replace(/^https?:\/\//, '')}</b>
            <button className="btn btn-outline btn-sm" onClick={() => copyLink(toast)}><Icon name="copy" size={14} /> Copy</button>
          </div>
          <div className="share-row qr-row">
            <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="qr-mini" role="img" aria-label="QR code for the sign-up link"><rect width={qr.size} height={qr.size} fill="#fff" /><path d={qr.d} fill="#000" /></svg>
            <div className="grow"><b>Printable QR code</b><span className="muted small">Download it for the notice board</span></div>
            <button className="btn btn-outline btn-sm" onClick={downloadQr}><Icon name="download" size={14} /> Download</button>
          </div>
        </section>

        {pending > 0 && (
          <div className="waiting-box">
            <span className="dot" /> <span className="grow"><b>{pending} {pending === 1 ? 'person is' : 'people are'}</b> waiting for you to check them</span>
            <button className="link-btn saf" onClick={onReview}>Review <Icon name="arrow-right" size={14} /></button>
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}

const downloadQr = () => {
  const a = document.createElement('a')
  a.href = qrPng(signupLink())
  a.download = 'temple-sign-up-qr.png'
  a.click()
}

// "Show QR code": big enough to scan from the screen, or print for the notice board.
function QrDialog({ onClose }: { onClose: () => void }) {
  const qr = qrPath(signupLink())
  // While this is open, printing prints just the QR (see .printing-qr in styles.css)
  useEffect(() => {
    document.body.classList.add('printing-qr')
    return () => document.body.classList.remove('printing-qr')
  }, [])
  return (
    <Modal
      title="Sign-up QR code"
      subtitle="Scan with a phone camera to open the sign-up page."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-outline" onClick={() => window.print()}><Icon name="list" size={16} /> Print</button>
          <button className="btn btn-primary" onClick={downloadQr}><Icon name="download" size={16} /> Download</button>
        </>
      }
    >
      <div className="qr-big print-area">
        <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code for the sign-up link"><rect width={qr.size} height={qr.size} fill="#fff" /><path d={qr.d} fill="#000" /></svg>
        <b>{BRAND.templeName}: join the temple team</b>
        <span className="muted">{signupLink().replace(/^https?:\/\//, '')}</span>
      </div>
    </Modal>
  )
}

// P5 Check new sign-ups: one card per person, Approve or Not now.
export function SignupsDrawer({ pending, rejected, onClose, onChange }: { pending: User[]; rejected: User[]; onClose: () => void; onChange: () => void }) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState<User | null>(null)
  const [showRejected, setShowRejected] = useState(false)

  const approve = async (u: User) => {
    setError('')
    setBusyId(u.id)
    try {
      const r = await usersApi.approve(u.id)
      toast(r.message)
      onChange()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const when = (iso: string) => {
    const d = new Date(iso)
    const today = new Date().toDateString() === d.toDateString()
    const y = new Date(); y.setDate(y.getDate() - 1)
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    if (today) return `Today, ${time}`
    if (y.toDateString() === d.toDateString()) return `Yesterday, ${time}`
    return timeAgo(iso)
  }

  return (
    <>
      <Modal
        title="New sign-ups"
        size="drawer"
        onClose={onClose}
        head={
          <div>
            <h2 className="row" style={{ gap: 12 }}><span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--saf)', display: 'inline-block' }} /> New sign-ups ({pending.length})</h2>
            <p className="modal-sub">Review people who registered to join the temple team</p>
          </div>
        }
        footer={<div className="drawer-note"><span className="tile-ic ic-ind" style={{ width: 38, height: 38 }}><Icon name="message" size={18} /></span> Approved people get an email and can sign in straight away</div>}
      >
        <ErrorNote>{error}</ErrorNote>
        {!pending.length && <p className="muted">Nobody is waiting. New sign-ups appear here.</p>}
        {pending.map((u) => (
          <article key={u.id} className="signup-card">
            <h3>{u.full_name} <span className="when-chip"><Icon name="clock" size={14} /> {when(u.created_at)}</span></h3>
            {u.phone && <div className="kv-line"><Icon name="phone" size={16} /> {u.phone}</div>}
            <div className="kv-line"><Icon name="mail" size={16} /> {u.email}</div>
            <div className="kv-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span className="ulabel">Joining as:</span>
              <span className="saf-chip"><Icon name={u.role === 'volunteer' ? 'heart' : u.role === 'staff' ? 'badge' : 'users'} size={14} /> {ROLE_LABELS[u.role]}</span>
              {u.designation && <span className="saf-chip">{DESIGNATION_LABELS[u.designation]}</span>}
            </div>
            <SignupAnswers details={u.signup_details} />
            {u.role === 'committee' && (
              <div className="quote"><b><Icon name="alert" size={16} /> Committee access</b><p>Only approve if you asked them to join. Then set what they can see and do in their details (People → their name).</p></div>
            )}
            <div className="signup-actions">
              <button className="btn btn-saf" disabled={busyId === u.id} onClick={() => approve(u)}><Icon name="check-circle" /> {busyId === u.id ? 'Approving…' : 'Approve'}</button>
              <button className="btn btn-outline" onClick={() => setRejecting(u)}>Not now</button>
            </div>
          </article>
        ))}
        {rejected.length > 0 && (
          <div>
            <button className="done-toggle" onClick={() => setShowRejected((v) => !v)} aria-expanded={showRejected}>
              Turned down ({rejected.length}) <Icon name="chevron-down" size={16} />
            </button>
            {showRejected && rejected.map((u) => (
              <div key={u.id} className="kv-line" style={{ padding: '8px 6px' }}>
                <span className="grow"><b>{u.full_name}</b> <span className="muted small">· {u.rejection_reason}</span></span>
                <button className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => approve(u)}>Approve after all</button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      {rejecting && (
        <RejectDialog
          person={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(m) => { toast(m); setRejecting(null); onChange() }}
        />
      )}
    </>
  )
}

export function RejectDialog({ person, onClose, onDone }: { person: User; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await usersApi.reject(person.id, reason)
      onDone(r.message)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Not now for ${person.full_name}?`}
      subtitle="They'll get an email with your reason. You can approve them later."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim() || busy} onClick={submit}>{busy ? 'Sending…' : 'Turn down'}</button>
        </>
      }
    >
      <label className="field">
        <span className="label">Reason <span className="muted">(sent to them by email)</span></span>
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. We couldn't confirm your details. Please speak to the temple office." />
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}

// The sign-up form's answers (W2) as the committee sees them (P5, P2)
export function SignupAnswers({ details }: { details?: SignupDetails | null }) {
  if (!details || (!details.availability?.length && !details.help?.length)) return null
  return (
    <dl className="signup-answers">
      {details.availability?.length > 0 && <><dt>Available</dt><dd>{details.availability.map((k) => AVAILABILITY_LABELS[k]).join(', ')}</dd></>}
      {details.help?.length > 0 && <><dt>Areas</dt><dd>{details.help.map((k) => HELP_LABELS[k]).join(', ')}</dd></>}
      {details.rules_agreed_at && <><dt>Rules</dt><dd>Agreed {new Date(details.rules_agreed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</dd></>}
    </dl>
  )
}
