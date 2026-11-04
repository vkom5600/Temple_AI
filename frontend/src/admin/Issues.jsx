import { useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES } from '../data'
import { nameOf, ago, suggestRole, suggestedTitle, assigneeLabel } from '../lib'
import { Icon, Badge, Empty } from '../ui.jsx'
import TaskForm from './TaskForm.jsx'

export default function Issues() {
  const { s, act } = useStore()
  const [convert, setConvert] = useState(null)
  const [show, setShow] = useState('open')
  const list = s.issues.filter((i) => (show === 'open' ? i.status === 'open' : i.status !== 'open'))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Issues</h1>
          <p className="muted">Problems staff reported, or tasks they couldn't finish. Turn each into a task for the right person.</p>
        </div>
      </header>
      <div className="seg seg-inline">
        <button className={show === 'open' ? 'on' : ''} onClick={() => setShow('open')}>Open</button>
        <button className={show === 'closed' ? 'on' : ''} onClick={() => setShow('closed')}>Handled</button>
      </div>

      {!list.length && <Empty icon="check">No {show} issues.</Empty>}
      <div className="stack">
        {list.map((i) => {
          const task = s.tasks.find((t) => t.id === i.taskId)
          const newTask = s.tasks.find((t) => t.id === i.newTaskId)
          const role = suggestRole(i.text)
          return (
            <div key={i.id} className="card issue">
              <div className="grow">
                <div className="row"><Badge tone="red">{i.reason}</Badge><span className="muted small">{nameOf(s.users, i.by)} · {ago(i.at)}</span></div>
                <div className="issue-text">{i.text}</div>
                {task && <div className="meta">On task: {task.title}</div>}
                {i.status === 'open' && <div className="suggest"><Icon name="sparkle" size={14} /> Suggested: "{suggestedTitle(i.text)}" for <b>{ROLES[role].label}</b></div>}
                {i.status === 'converted' && newTask && <div className="meta">→ Task "{newTask.title}" assigned to {assigneeLabel(newTask.assignee, s.users)}</div>}
                {i.status === 'resolved' && <div className="meta">Marked resolved</div>}
              </div>
              {i.status === 'open' && (
                <div className="col-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setConvert(i)}>Create task</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => act({ type: 'resolveIssue', id: i.id, log: 'Resolved an issue', toast: 'Issue closed' })}>Mark resolved</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {convert && (
        <TaskForm
          title="Create a task from this issue"
          initial={{ title: suggestedTitle(convert.text), assignee: { type: 'role', id: suggestRole(convert.text) }, notes: `Reported by ${nameOf(s.users, convert.by)}: ${convert.text}`, priority: 'high', kind: 'one-off' }}
          onClose={() => setConvert(null)}
          onSave={(task) => {
            act({ type: 'convertIssue', id: convert.id, task, log: `Created task "${task.title}" from an issue`, toast: `Task assigned to ${assigneeLabel(task.assignee, s.users)}` })
            setConvert(null)
          }}
        />
      )}
    </div>
  )
}
