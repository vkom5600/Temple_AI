import { useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES } from '../data'
import { isOverdue, isFinished, assigneeLabel, nameOf, fmtWhen, categoryOf } from '../lib'
import { Icon, Badge, StatusBadge, Empty, Modal } from '../ui.jsx'
import TaskForm from './TaskForm.jsx'

const FILTERS = [
  { id: 'all', label: 'All open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'awaiting', label: 'Waiting for sign-off' },
  { id: 'flagged', label: "Couldn't do" },
  { id: 'done', label: 'Done' },
]

const KIND = { daily: 'Daily', weekly: 'Weekly', 'one-off': 'One-off', event: 'Event', booking: 'Booking' }

export default function Tasks({ filter, setFilter }) {
  const { s, act } = useStore()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [who, setWho] = useState('all')
  const [cat, setCat] = useState('all')

  const match = (t) => {
    if (filter === 'overdue') return isOverdue(t)
    if (filter === 'awaiting') return t.status === 'awaiting'
    if (filter === 'flagged') return t.status === 'flagged'
    if (filter === 'done') return t.status === 'done' || t.status === 'verified'
    return !isFinished(t)
  }
  const byWho = (t) => who === 'all' || (t.assignee.type === 'role' ? t.assignee.id === who : s.users.find((u) => u.id === t.assignee.id)?.role === who)
  const byCat = (t) => cat === 'all' || categoryOf(t, s.users) === cat
  const cats = [...new Set(s.tasks.map((t) => categoryOf(t, s.users)))].sort()
  const list = s.tasks.filter((t) => match(t) && byWho(t) && byCat(t)).sort((a, b) => new Date(a.due) - new Date(b.due))
  const roleOptions = Object.entries(ROLES).filter(([, r]) => r.group !== 'admin')

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">Only the chairman and committee create tasks. Staff tick them off or report a problem.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New task</button>
      </header>

      <div className="toolbar">
        <div className="seg seg-inline">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by role">
          <option value="all">Everyone</option>
          {roleOptions.map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Task</th><th>Assigned to</th><th>Where</th><th>Due</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={isOverdue(t) ? 'row-overdue' : ''}>
                  <td>
                    <button className="cell-title" onClick={() => setViewing(t)}>{t.title}</button>
                    <div className="badges">
                      <Badge tone="blue">{categoryOf(t, s.users)}</Badge>
                      {t.kind !== 'booking' && <Badge>{KIND[t.kind] ?? t.kind}</Badge>}
                      {t.critical && <Badge tone="amber">Sign-off</Badge>}
                      {t.priority === 'high' && <Badge tone="red">High</Badge>}
                    </div>
                  </td>
                  <td>{assigneeLabel(t.assignee, s.users)}</td>
                  <td>{t.area}</td>
                  <td className="nowrap">{fmtWhen(t.due)}</td>
                  <td><StatusBadge task={t} /></td>
                  <td className="nowrap">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(t)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="check">No tasks here.</Empty>
      )}

      {creating && (
        <TaskForm
          showTemplates
          onClose={() => setCreating(false)}
          onSave={(task) => {
            act({ type: 'createTasks', tasks: [task], log: `Assigned "${task.title}"`, toast: `Task sent to ${assigneeLabel(task.assignee, s.users)}` })
            setCreating(false)
          }}
        />
      )}

      {editing && (
        <TaskForm
          title="Edit task"
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            act({ type: 'updateTask', id: editing.id, patch, log: `Updated "${patch.title}"`, toast: 'Task updated' })
            setEditing(null)
          }}
        />
      )}

      {viewing && (
        <Modal
          title="Task details"
          onClose={() => setViewing(null)}
          footer={
            <>
              <button className="btn btn-danger-ghost" onClick={() => { act({ type: 'deleteTask', id: viewing.id, log: `Cancelled "${viewing.title}"`, toast: 'Task cancelled' }); setViewing(null) }}>Cancel task</button>
              <button className="btn btn-outline" onClick={() => { setEditing(viewing); setViewing(null) }}>Edit / reassign</button>
            </>
          }
        >
          <h3 className="detail-title">{viewing.title}</h3>
          <dl className="details">
            <dt>Category</dt><dd>{categoryOf(viewing, s.users)}</dd>
            {viewing.source?.bookingId && <><dt>Booking</dt><dd>{s.bookings.find((b) => b.id === viewing.source.bookingId)?.title ?? 'Removed booking'}</dd></>}
            <dt>Assigned to</dt><dd>{assigneeLabel(viewing.assignee, s.users)}</dd>
            <dt>Where</dt><dd>{viewing.area}</dd>
            <dt>Due</dt><dd>{fmtWhen(viewing.due)}</dd>
            <dt>Status</dt><dd><StatusBadge task={viewing} /></dd>
            {viewing.completedBy && <><dt>Done by</dt><dd>{nameOf(s.users, viewing.completedBy)}, {fmtWhen(viewing.completedAt)}</dd></>}
            {viewing.verifiedBy && <><dt>Signed off by</dt><dd>{nameOf(s.users, viewing.verifiedBy)}, {fmtWhen(viewing.verifiedAt)}</dd></>}
            {viewing.notes && <><dt>Notes</dt><dd>{viewing.notes}</dd></>}
          </dl>
          {viewing.comments.length > 0 && (
            <>
              <h4>Comments</h4>
              <ul className="comments">
                {viewing.comments.map((c, i) => <li key={i}><b>{nameOf(s.users, c.by)}:</b> {c.text} <span className="muted small">· {fmtWhen(c.at)}</span></li>)}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
