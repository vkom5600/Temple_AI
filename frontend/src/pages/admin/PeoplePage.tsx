import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { usersApi } from '../../api/endpoints'
import { DESIGNATION_LABELS, ROLE_GROUPS, ROLE_LABELS, jobLabel } from '../../constants'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, ErrorNote, Icon, Modal, Spinner } from '../../components/ui'
import type { Designation, User, UserInput } from '../../types'
import Registrations from './Registrations'

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

// Everyone on the team. Chairman can add/edit/deactivate; committee can view.
export default function PeoplePage() {
  const { user: me } = useAuth()
  const canEdit = me?.role === 'chairman'
  const [people, setPeople] = useState<User[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<User | 'new' | null>(null)

  const load = useCallback(() => {
    usersApi.list().then((r) => setPeople(r.users)).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const approved = people?.filter((p) => p.approval_status === 'approved') ?? []
  const active = approved.filter((p) => p.is_active)
  const inactive = approved.filter((p) => !p.is_active)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="muted">
            {canEdit ? 'Add people, set their job, and switch off accounts for anyone who has left.' : 'Everyone on the temple team.'}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> Add person
          </button>
        )}
      </header>

      <ErrorNote>{error}</ErrorNote>
      {!people && !error && <Spinner />}

      {canEdit && people && (
        <Registrations
          pending={people.filter((p) => p.approval_status === 'pending')}
          rejected={people.filter((p) => p.approval_status === 'rejected')}
          onChange={load}
        />
      )}

      {ROLE_GROUPS.map(({ role, label }) => {
        const group = active.filter((p) => p.role === role)
        if (!group.length) return null
        return (
          <section key={role} className="panel">
            <div className="panel-head"><h2>{label}</h2><span className="muted small">{group.length}</span></div>
            <PeopleList people={group} canEdit={canEdit} onPick={setEditing} />
          </section>
        )
      })}

      {inactive.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Inactive</h2><span className="muted small">{inactive.length}</span></div>
          <PeopleList people={inactive} canEdit={canEdit} onPick={setEditing} />
        </section>
      )}

      {editing && (
        <PersonForm
          person={editing === 'new' ? null : editing}
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

function PeopleList({ people, canEdit, onPick }: { people: User[]; canEdit: boolean; onPick: (u: User) => void }) {
  return (
    <div className="people-list">
      {people.map((u) => {
        const body = (
          <>
            <Avatar name={u.full_name} />
            <div className="grow">
              <div className="strong">{u.full_name}</div>
              <div className="muted small">{jobLabel(u)}</div>
              <div className="muted small">{[u.phone, u.email].filter(Boolean).join(' · ')}</div>
            </div>
            {!u.is_active && <Badge>Inactive</Badge>}
          </>
        )
        const editable = canEdit && u.role !== 'chairman'
        return editable ? (
          <button key={u.id} className="person-row person-btn" onClick={() => onPick(u)} title="Edit details">{body}</button>
        ) : (
          <div key={u.id} className="person-row">{body}</div>
        )
      })}
    </div>
  )
}

function PersonForm({ person, onClose, onSaved }: { person: User | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<UserInput>(person ? toInput(person) : BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof UserInput>(key: K, value: UserInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const isNew = !person
  const needsJob = form.role === 'staff' && !form.designation
  const passwordOk = isNew ? (form.password ?? '').length >= 8 : !form.password || form.password.length >= 8
  const canSave = form.full_name.trim() && form.email.trim() && !needsJob && passwordOk && !busy

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError('')
    setBusy(true)
    try {
      await action()
      toast(message)
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

  const toggleActive = () =>
    person &&
    run(
      () => usersApi.setActive(person.id, !person.is_active),
      person.is_active ? `${person.full_name} can no longer sign in` : `${person.full_name} can sign in again`,
    )

  return (
    <Modal
      title={person ? `Edit ${person.full_name}` : 'Add person'}
      onClose={onClose}
      footer={
        <>
          {person && (
            <button className={`btn ${person.is_active ? 'btn-danger-ghost' : 'btn-ghost'} push-left`} onClick={toggleActive} disabled={busy}>
              {person.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={save}>{busy ? 'Saving…' : person ? 'Save' : 'Add'}</button>
        </>
      }
    >
      <label className="field">
        <span className="label">Name</span>
        <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
      </label>

      <div className="form-grid">
        <label className="field">
          <span className="label">Access</span>
          <select value={form.role} onChange={(e) => set('role', e.target.value as UserInput['role'])}>
            {(['committee', 'staff', 'volunteer'] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        {form.role === 'staff' && (
          <label className="field">
            <span className="label">Job</span>
            <select value={form.designation} onChange={(e) => set('designation', e.target.value as Designation | '')}>
              <option value="">Choose…</option>
              {Object.entries(DESIGNATION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
      <p className="muted small">Committee can see everything and manage the day. Staff and volunteers see their own work.</p>

      <div className="form-grid">
        <label className="field">
          <span className="label">Email <span className="muted">(used to sign in)</span></span>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
        </label>
        <label className="field">
          <span className="label">Mobile</span>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7…" />
        </label>
        <label className="field">
          <span className="label">Emergency contact <span className="muted">(optional)</span></span>
          <input value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Name and number" />
        </label>
        <label className="field">
          <span className="label">Joined <span className="muted">(optional)</span></span>
          <input type="date" value={form.joining_date} onChange={(e) => set('joining_date', e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span className="label">{isNew ? 'Starting password' : 'New password'} <span className="muted">{isNew ? '(8+ characters; tell them in person)' : '(leave blank to keep the current one)'}</span></span>
        <input type="text" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />
      </label>

      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
