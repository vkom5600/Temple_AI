import { useState } from 'react'
import { useStore } from '../store.jsx'
import { GROUPS, ROLES } from '../data'
import { tasksForUser, isOverdue, isFinished, isToday } from '../lib'
import { Icon, Avatar, Modal } from '../ui.jsx'

export default function People() {
  const { s, act } = useStore()
  const [form, setForm] = useState(null) // null | { id?, name, role, phone, email }
  const blank = { name: '', role: 'volunteer', phone: '', email: '' }
  const f = form ?? blank
  const setF = setForm
  const emailOk = !f.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)
  const save = () => {
    const user = { name: f.name.trim(), role: f.role, phone: f.phone.trim(), email: f.email.trim() }
    if (f.id) act({ type: 'updateUser', id: f.id, patch: user, log: `Updated ${user.name}'s details`, toast: 'Details saved' })
    else act({ type: 'addUser', user, log: `Added ${user.name} as ${ROLES[user.role].label}`, toast: `${user.name} added` })
    setForm(null)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>People & roles</h1>
          <p className="muted">Tasks go to a role, so when someone new joins (or covers a shift) they see the role's tasks straight away.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm(blank)}><Icon name="plus" size={16} /> Add person</button>
      </header>

      {Object.entries(GROUPS).map(([g, label]) => {
        const people = s.users.filter((u) => ROLES[u.role]?.group === g)
        if (!people.length) return null
        return (
          <section key={g} className="panel">
            <div className="panel-head"><h2>{label}</h2><span className="muted small">{people.length}</span></div>
            <div className="people-list">
              {people.map((u) => {
                const t = tasksForUser(s.tasks, u)
                const today = t.filter((x) => isToday(x.due) || isOverdue(x))
                const done = today.filter(isFinished).length
                const late = t.filter(isOverdue).length
                return (
                  <button key={u.id} className="person-row person-btn" onClick={() => setForm({ phone: '', email: '', ...u })} title="Edit details">
                    <Avatar user={u} />
                    <div className="grow">
                      <div className="strong">{u.name}</div>
                      <div className="muted small">{ROLES[u.role].label}</div>
                      <div className="muted small">
                        {u.phone || u.email ? [u.phone, u.email].filter(Boolean).join(' · ') : <span className="amber">No phone or email yet</span>}
                      </div>
                    </div>
                    {g !== 'admin' && g !== 'committee' && (
                      <div className="small right">
                        {today.length ? `${done}/${today.length} today` : 'No tasks today'}
                        {late > 0 && <div className="red">{late} overdue</div>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {form && (
        <Modal
          title={f.id ? `Edit ${f.name || 'person'}` : 'Add person'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!f.name.trim() || !emailOk} onClick={save}>{f.id ? 'Save' : 'Add'}</button>
            </>
          }
        >
          <label className="field"><span className="label">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
          {f.role !== 'chairman' && (
            <label className="field">
              <span className="label">Role</span>
              <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                {Object.entries(ROLES).filter(([id]) => id !== 'chairman').map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
              </select>
            </label>
          )}
          <div className="form-grid">
            <label className="field"><span className="label">Mobile <span className="muted">(text / WhatsApp alerts)</span></span><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+44 7…" /></label>
            <label className="field">
              <span className="label">Email <span className="muted">(summaries, reminders)</span></span>
              <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" />
              {!emailOk && <span className="red small">That email doesn't look right.</span>}
            </label>
          </div>
          <p className="muted small">Both are optional. Staff who don't use email can still get text alerts.</p>
        </Modal>
      )}
    </div>
  )
}
