import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useAdminContext } from '../../layouts/AdminLayout'
import { attendanceApi, tasksApi, usersApi } from '../../api/endpoints'
import { DESIGNATION_LABELS, ROLE_GROUPS, ROLE_LABELS, jobLabel } from '../../constants'
import { fmtTime, toDateInput } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, ErrorNote, Icon, Modal, Spinner } from '../../components/ui'
import type { AttendanceDay, Designation, PresenceRow, Role, Task, User, UserInput, Access } from '../../types'
import { SignupsCard, SignupsDrawer } from './Registrations'
import TaskDetails from '../../components/tasks/TaskDetails'
import { AREA_INFO, DEFAULT_ACCESS, allowed, can } from '../../lib/access'
import ViewOnly from '../../components/ViewOnly'

const BLANK: UserInput = {
  full_name: '',
  email: '',
  role: 'staff',
  phone: '',
  designation: '',
  emergency_contact: '',
  joining_date: '',
  password: '',
}

const toInput = (u: User): UserInput => ({
  full_name: u.full_name,
  email: u.email,
  role: u.role === 'chairman' ? 'committee' : u.role,
  phone: u.phone ?? '',
  designation: u.designation ?? '',
  emergency_contact: u.emergency_contact ?? '',
  joining_date: u.joining_date?.slice(0, 10) ?? '',
  password: '',
})

// P1 People (design: screens/26_P1_people.png): staff, volunteers and committee,
// with today's attendance beside each name. Chairman adds, edits and approves sign-ups.
export default function PeoplePage() {
  const { user: me } = useAuth()
  const isChairman = me?.role === 'chairman'
  // The chairman, or a committee member with People: Manage (staff and volunteers only)
  const canEdit = can(me ?? null, 'people', 'manage')
  const viewOnly = !canEdit
  const { openBroadcast } = useAdminContext()
  const [people, setPeople] = useState<User[] | null>(null)
  const [day, setDay] = useState<AttendanceDay | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [params, setParams] = useSearchParams()
  const reviewing = params.get('review') === 'signups'
  const setReviewing = (on: boolean) => setParams(on ? { review: 'signups' } : {}, { replace: true })

  const load = useCallback(() => {
    usersApi.list().then((r) => setPeople(r.users)).catch((e: Error) => setError(e.message))
    attendanceApi.day().then(setDay).catch(() => {})
  }, [])

  useEffect(load, [load])

  const presence = new Map(day?.people.map((p) => [p.user_id, p]) ?? [])
  const approved = people?.filter((p) => p.approval_status === 'approved') ?? []
  const q = query.trim().toLowerCase()
  const match = (p: User) =>
    (!role || p.role === role) &&
    (!q || `${p.full_name} ${jobLabel(p)} ${p.phone ?? ''} ${p.email}`.toLowerCase().includes(q))
  const active = approved.filter((p) => p.is_active && match(p))
  const inactive = approved.filter((p) => !p.is_active && match(p))
  const expected = day ? day.people.length - day.counts.absent : 0

  // Staff first, as in the design: they're the ones checking in.
  const groups: { label: string; list: User[] }[] = [
    { label: 'Staff', list: active.filter((p) => p.role === 'staff') },
    { label: 'Volunteers', list: active.filter((p) => p.role === 'volunteer') },
    { label: 'Committee', list: active.filter((p) => p.role === 'chairman' || p.role === 'committee') },
    { label: 'Switched off', list: inactive },
  ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>People {viewOnly && <ViewOnly />}</h1>
          <p>Staff, volunteers and committee</p>
        </div>
        <div className="head-actions">
          {allowed(me ?? null, 'broadcast') && <button className="btn btn-outline" onClick={openBroadcast}><Icon name="send" size={16} /> Broadcast</button>}
          {canEdit && <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add person</button>}
        </div>
      </header>

      {day && (
        <section className="list-card onsite-bar">
          <b>{day.counts.here} of {expected} on site</b>
          <div className="bar green"><i style={{ width: `${expected ? (day.counts.here / expected) * 100 : 0}%` }} /></div>
          {day.counts.not_in > 0 && (
            <span className="row" style={{ gap: 6 }}>
              <span className="muted small">Not in yet:</span>
              {day.people.filter((p) => p.state === 'not_in').map((p) => <span key={p.user_id} className="pill pill-saf">{p.full_name.split(' ')[0]}</span>)}
            </span>
          )}
        </section>
      )}

      <ErrorNote>{error}</ErrorNote>
      {!people && !error && <Spinner />}

      {canEdit && people && <SignupsCard pending={people.filter((p) => p.approval_status === 'pending')} onReview={() => setReviewing(true)} />}
      {canEdit && people && reviewing && (
        <SignupsDrawer
          pending={people.filter((p) => p.approval_status === 'pending')}
          rejected={people.filter((p) => p.approval_status === 'rejected')}
          onClose={() => setReviewing(false)}
          onChange={load}
        />
      )}

      <div className="filters">
        <label className="search" style={{ maxWidth: 520 }}>
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, role or phone" aria-label="Search people" />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role | '')} aria-label="Role" style={{ marginLeft: 'auto' }}>
          <option value="">Role: All</option>
          {ROLE_GROUPS.map((g) => <option key={g.role} value={g.role}>{g.label}</option>)}
        </select>
      </div>

      {people && (
        <section className="list-card">
          <table className="ptable">
            <tbody>
              {groups.filter((g) => g.list.length).map((g) => (
                <Fragment key={g.label}>
                  <tr className="group"><td colSpan={6}>{g.label} ({g.list.length})</td></tr>
                  {g.list.map((u) => {
                    return (
                      <tr
                        key={u.id}
                        className="prow"
                        onClick={() => setEditing(u)}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setEditing(u)}
                      >
                        <td><span className="pname"><Avatar name={u.full_name} size={38} /> {u.full_name}{u.id === me?.id && <span className="muted small">(you)</span>}</span></td>
                        <td>{u.role === 'committee' ? 'Committee member' : jobLabel(u)}</td>
                        <td className="mono">{u.phone ?? '—'}</td>
                        <td className="email">{u.email}</td>
                        <td><Presence row={presence.get(u.id)} active={u.is_active} /></td>
                        <td className="chev"><Icon name="chevron-right" size={18} /></td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {editing && (
        <PersonForm
          presence={editing === 'new' ? undefined : presence.get(editing.id)}
          person={editing === 'new' ? null : editing}
          canEdit={editing === 'new' ? canEdit : isChairman ? editing.role !== 'chairman' : canEdit && (editing.role === 'staff' || editing.role === 'volunteer')}
          isChairman={isChairman}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// "On site · 08:10", "Left 17:05", "Not in yet", "Absent", or "—" for people who don't check in.
function Presence({ row, active }: { row?: PresenceRow; active: boolean }) {
  if (!active) return <Badge>Switched off</Badge>
  if (!row) return <span className="muted">—</span>
  if (row.state === 'here') return <span className="status st-here"><span className="dot" /> On site · {fmtTime(row.check_in!)}</span>
  if (row.state === 'left') return <span className="status st-left"><span className="dot" /> Left {fmtTime(row.check_out!)}</span>
  if (row.state === 'absent') return <span className="status st-absent"><span className="dot" /> Absent</span>
  return <span className="status st-off"><span className="dot" /> Not in yet</span>
}

// P2 Person details and edit / P3 Add person (designs: screens/28_P2).
// Opens on the details; the ⋮ menu has Edit and Remove person (chairman only).
function PersonForm({ person, presence, canEdit, isChairman, onClose, onSaved }: { person: User | null; presence?: PresenceRow; canEdit: boolean; isChairman: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<UserInput>(person ? toInput(person) : BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [editMode, setEditMode] = useState(!person)
  const [removing, setRemoving] = useState(false)
  const [viewingTask, setViewingTask] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [week, setWeek] = useState<{ date: string; state: string }[] | null>(null)
  const set = <K extends keyof UserInput>(key: K, value: UserInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const isNew = !person
  const checksIn = person && (person.role === 'staff' || person.role === 'volunteer')
  const needsJob = form.role === 'staff' && !form.designation
  const passwordOk = isNew ? (form.password ?? '').length >= 8 : !form.password || form.password.length >= 8
  const canSave = form.full_name.trim() && form.email.trim() && !needsJob && passwordOk && !busy

  const loadTasks = useCallback(() => {
    if (!person) return
    tasksApi.list({ view: 'today' }).then((r) => setTasks(r.tasks.filter((t) => t.assigned_to === person.id))).catch(() => setTasks([]))
  }, [person])

  useEffect(() => {
    if (!person) return
    loadTasks()
    if (!checksIn) return
    // Last 7 days of attendance, one day at a time (small team, so 7 quick requests).
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return toDateInput(d) })
    Promise.all(days.map((d) => attendanceApi.day(d).then((r) => r.people.find((p) => p.user_id === person.id)?.state ?? 'none').catch(() => 'none')))
      .then((states) => setWeek(days.map((date, i) => ({ date, state: states[i] }))))
  }, [person, checksIn, loadTasks])

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError('')
    setBusy(true)
    try {
      await action()
      if (message) toast(message)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const save = () =>
    run(
      () => (person ? usersApi.update(person.id, form) : usersApi.create(form)),
      person ? 'Details saved' : `${form.full_name.trim()} added`,
    )

  const remove = () => person && run(() => usersApi.remove(person.id).then((r) => { toast(r.message) }), '')
  const cancelEdit = () => { if (!person) return onClose(); setForm(toInput(person)); setError(''); setEditMode(false) }

  const toggleActive = () =>
    person &&
    run(
      () => usersApi.setActive(person.id, !person.is_active),
      person.is_active ? `${person.full_name} can no longer sign in` : `${person.full_name} can sign in again`,
    )

  const statusPill = presence?.state === 'here'
    ? <span className="pill pill-grn"><span className="dot" /> On site since {fmtTime(presence.check_in!)}</span>
    : presence?.state === 'left'
      ? <span className="pill pill-soft">Left {fmtTime(presence.check_out!)}</span>
      : presence?.state === 'absent' ? <span className="pill pill-red">Absent today</span> : null
  const attended = week?.filter((d) => d.state === 'here' || d.state === 'left').length ?? 0

  return (
    <Modal
      title={person ? person.full_name : 'Add person'}
      size="wide"
      onClose={onClose}
      head={person ? (
        <div className="person-head">
          <span className="big-av">{person.full_name[0]?.toUpperCase()}</span>
          <div className="grow">
            <h2>{person.full_name} {statusPill}</h2>
            <p>{person.role === 'committee' ? 'Committee member' : jobLabel(person)} · {ROLE_LABELS[person.role]}</p>
          </div>
          <div className="kebab">
            <button className="icon-btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="more" size={20} /></button>
            {menu && (
              <div className="kebab-menu" role="menu">
                {canEdit ? (
                  <>
                    <button role="menuitem" onClick={() => { setMenu(false); setRemoving(false); setEditMode(true) }}><Icon name="edit" /> Edit</button>
                    <button role="menuitem" onClick={() => { setMenu(false); toggleActive() }}>
                      <Icon name={person.is_active ? 'lock' : 'key'} /> {person.is_active ? 'Switch off sign-in' : 'Switch sign-in back on'}
                    </button>
                    {isChairman && <button role="menuitem" className="danger" onClick={() => { setMenu(false); setEditMode(false); setRemoving(true) }}><Icon name="trash" /> Remove person</button>}
                  </>
                ) : (
                  <p className="kebab-note">{person.role === 'committee' || person.role === 'chairman' ? 'Only the chairman can change committee members.' : 'You can view people but not change them.'}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : undefined}
      subtitle={isNew ? 'They sign in with this email and the starting password you give them.' : undefined}
      footer={removing && person ? (
        <>
          <button className="btn btn-outline" onClick={() => setRemoving(false)}>Keep {person.full_name.split(' ')[0]}</button>
          <button className="btn btn-danger btn-lg" disabled={busy} onClick={remove}><Icon name="trash" /> {busy ? 'Removing…' : `Remove ${person.full_name.split(' ')[0]}`}</button>
        </>
      ) : !editMode ? (
        <>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {canEdit && <button className="btn btn-primary btn-lg" onClick={() => setEditMode(true)}><Icon name="edit" /> Edit details</button>}
        </>
      ) : (
        <>
          <button className="btn btn-outline" onClick={cancelEdit}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!canSave} onClick={save}><Icon name="check" /> {busy ? 'Saving…' : person ? 'Save changes' : 'Add person'}</button>
        </>
      )}
    >
      {removing && person && (
        <div className="remove-warn" role="alert">
          <Icon name="alert" size={20} />
          <div>
            <b>Remove {person.full_name} from the temple team?</b>
            <p>They won't be able to sign in and won't show in People any more. Their past tasks, attendance and the activity log keep their name. Any open tasks still assigned to them will need someone new.</p>
          </div>
        </div>
      )}
      {!editMode && person ? <PersonFacts person={person} /> : <div className="filled stack" style={{ gap: 16 }}>
        <div className="grid-2f">
          <label className="field">
            <span className="ulabel">Full name</span>
            <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus={isNew} />
          </label>
          <label className="field">
            <span className="ulabel">Job</span>
            {form.role === 'staff' ? (
              <select value={form.designation} onChange={(e) => set('designation', e.target.value as Designation | '')}>
                <option value="">Choose…</option>
                {Object.entries(DESIGNATION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            ) : (
              <input value={form.role === 'committee' ? 'Committee member' : 'Volunteer'} disabled />
            )}
          </label>
        </div>

        <div className="field">
          <span className="ulabel">Group</span>
          <div className="segmented">
            {(isChairman ? ['staff', 'volunteer', 'committee'] as const : ['staff', 'volunteer'] as const).map((r) => (
              <button key={r} type="button" className={form.role === r ? 'on' : ''} onClick={() => set('role', r)}>{ROLE_LABELS[r]}</button>
            ))}
          </div>
          <span className="muted small">Staff and volunteers get the phone app. Committee members get the admin app.</span>
        </div>

        <div className="grid-2f">
          <label className="field">
            <span className="ulabel">Phone number</span>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7…" />
          </label>
          <label className="field">
            <span className="ulabel">Email (to sign in)</span>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
          </label>
        </div>

        <div className="cols-3">
          <label className="field">
            <span className="ulabel">Emergency contact</span>
            <input value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Name and number" />
          </label>
          <label className="field">
            <span className="ulabel">Joined</span>
            <input type="date" value={form.joining_date} onChange={(e) => set('joining_date', e.target.value)} />
          </label>
          <label className="field">
            <span className="ulabel">{isNew ? 'Starting password' : 'New password'}</span>
            <input type="text" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={isNew ? '8+ characters' : 'Leave blank to keep'} />
          </label>
        </div>
      </div>}

      {person?.role === 'committee' && <AccessSection person={person} editable={isChairman} />}

      {person && (
        <div className={`status-bar ${person.is_active ? '' : 'off'}`}>
          <span className="dot" />
          <b>{person.is_active ? 'Active' : 'Switched off'}</b>
          <span className="muted">· {person.role === 'staff' || person.role === 'volunteer' ? 'uses the staff phone app' : 'uses the admin app'}</span>
          {canEdit && <button onClick={toggleActive} disabled={busy}>{person.is_active ? 'Switch off sign-in' : 'Switch back on'}</button>}
        </div>
      )}

      {checksIn && (
        <section className="dsec">
          <span className="ulabel">Last 7 days</span>
          <div className="week-box">
            <div className="week-dots">
              {(week ?? Array.from({ length: 7 }, (_, i) => ({ date: String(i), state: 'none' }))).map((d, i) => (
                <div key={d.date} className={`${d.state === 'here' || d.state === 'left' ? 'on' : d.state === 'absent' ? 'off' : ''} ${i === 6 ? 'is-today' : ''}`}>
                  <i>{d.state === 'here' || d.state === 'left' ? <Icon name="check" size={16} /> : d.state === 'absent' ? <Icon name="x" size={14} /> : ''}</i>
                  <span>{week ? new Date(`${d.date}T12:00:00`).toLocaleDateString([], { weekday: 'short' }) : ''}</span>
                </div>
              ))}
            </div>
            <div className="week-sum"><span>{week ? `${attended} of 7 days checked in` : 'Loading…'}</span><span className="muted small">Green = came in · red = marked absent</span></div>
          </div>
        </section>
      )}

      {person && (
        <section className="dsec">
          <div className="dsec-head" style={{ fontSize: 12.5, color: 'var(--muted)' }}><span>Today's tasks</span><small>{tasks ? `${tasks.length} assigned today` : ''}</small></div>
          {tasks && tasks.length > 0 ? (
            <div className="mini-tasks">
              {tasks.map((t) => (
                <button key={t.id} type="button" className="mini-task" onClick={() => setViewingTask(t.id)}>
                  <span className={`dot ${t.status === 'done' ? 'grn' : t.status === 'awaiting_signoff' || t.status === 'flagged' ? 'saf' : t.is_overdue ? 'red' : ''}`} />
                  <span className="grow">
                    <b>{t.title}</b>
                    <small className={t.status === 'done' ? 'done' : undefined}>
                      {t.status === 'awaiting_signoff' ? `Awaiting review · done ${fmtTime(t.completed_at!)}` : t.status === 'done' ? 'Done' : t.status === 'flagged' ? `⚑ Couldn't do · ${t.last_comment ?? ''}` : `Due ${fmtTime(t.due_at)}${t.is_overdue ? ' · overdue' : ''}`}
                    </small>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </button>
              ))}
            </div>
          ) : tasks ? <p className="muted small" style={{ margin: 0 }}>Nothing assigned to {person.full_name.split(' ')[0]} today.</p> : null}
        </section>
      )}

      <ErrorNote>{error}</ErrorNote>
      {viewingTask && <TaskDetails taskId={viewingTask} onClose={() => setViewingTask(null)} onChanged={loadTasks} />}
    </Modal>
  )
}

// P2 for committee members: the same details, read-only (only the chairman edits people).
function PersonFacts({ person }: { person: User }) {
  const facts: [string, React.ReactNode][] = [
    ['Phone number', person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : '—'],
    ['Email', <a href={`mailto:${person.email}`}>{person.email}</a>],
    ['Emergency contact', person.emergency_contact || '—'],
    ['Joined', person.joining_date ? new Date(`${person.joining_date.slice(0, 10)}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
  ]
  return (
    <dl className="facts">
      {facts.map(([label, value]) => (
        <div key={label}><dt className="ulabel">{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  )
}

// P2 "What Meena can see and do": the chairman sets each committee member's access.
// Saved straight away; the server checks it on every request.
function AccessSection({ person, editable }: { person: User; editable: boolean }) {
  const toast = useToast()
  const [access, setAccess] = useState<Access>({ ...DEFAULT_ACCESS, ...(person.access ?? {}) })
  const [busy, setBusy] = useState(false)
  const first = person.full_name.split(' ')[0]
  const save = async (next: Access) => {
    const before = access
    setAccess(next)
    setBusy(true)
    try { toast((await usersApi.setAccess(person.id, next)).message) } catch (err) { setAccess(before); toast((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="dsec">
      <div className="dsec-head"><span className="ulabel">What {first} can see and do</span><small className="muted">{editable ? 'Saved as you change it' : 'Set by the chairman'}</small></div>
      {AREA_INFO.map((a) => (
        <div key={a.area} className="access-row">
          <span className="tile-ic ic-soft"><Icon name={a.icon} size={18} /></span>
          <div className="grow"><b>{a.label}</b><span className="muted small">{a.hint}</span></div>
          <div className="segmented seg-sm" role="radiogroup" aria-label={a.label}>
            {a.levels.map((lv) => (
              <button key={lv} type="button" role="radio" aria-checked={access[a.area] === lv} className={access[a.area] === lv ? 'on' : ''} disabled={!editable || busy}
                onClick={() => access[a.area] !== lv && save({ ...access, [a.area]: lv })}>{lv[0].toUpperCase() + lv.slice(1)}</button>
            ))}
          </div>
        </div>
      ))}
      {([['broadcast', 'Send broadcasts', 'Messages to staff and volunteers'], ['ai', 'Ask AI and Plan with AI', `Answers only use what ${first} can see`]] as const).map(([flag, label, hint]) => (
        <div key={flag} className="access-row flag">
          <div className="grow"><b>{label}</b><span className="muted small">{hint}</span></div>
          <button className={`switch ${access[flag] ? 'on' : ''}`} role="switch" aria-checked={access[flag]} aria-label={label} disabled={!editable || busy} onClick={() => save({ ...access, [flag]: !access[flag] })}><span className="switch-knob" /></button>
        </div>
      ))}
    </section>
  )
}
