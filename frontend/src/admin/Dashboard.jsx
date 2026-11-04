import { useState } from 'react'
import { useStore } from '../store.jsx'
import { fmtInline, isToday, isOverdue, isFinished, assigneeLabel, nameOf, fmtWhen, ago, dailySummary, reminderText, tasksForUser, suggestRole, suggestedTitle, peopleFor, daysSince } from '../lib'
import { ROLES } from '../data'
import { Icon, Badge, Modal, CopyButton, Empty, StatusBadge } from '../ui.jsx'
import TaskForm from './TaskForm.jsx'
import Today from './Today.jsx'
import WhosOn from './WhosOn.jsx'
import SendMessage from './SendMessage.jsx'
import RequestBar from './RequestBar.jsx'

export default function Dashboard({ go }) {
  const { s, me, act } = useStore()
  const [reminder, setReminder] = useState(null)
  const [convert, setConvert] = useState(null)
  const [msg, setMsg] = useState('')
  const [creating, setCreating] = useState(false)
  const [reassign, setReassign] = useState(null)

  const today = s.tasks.filter((t) => isToday(t.due) || isOverdue(t))
  const overdue = s.tasks.filter(isOverdue).sort((a, b) => new Date(a.due) - new Date(b.due))
  const awaiting = s.tasks.filter((t) => t.status === 'awaiting')
  const issues = s.issues.filter((i) => i.status === 'open')
  const doneCount = today.filter(isFinished).length
  const myTasks = tasksForUser(s.tasks, me).filter((t) => t.status === 'todo')
  const summary = dailySummary(s)
  // Requests saved to memory come back here if nobody has closed them after a day.
  const openRequests = s.memory.filter((m) => m.kind === 'request' && m.status === 'open' && daysSince(m.at) >= 1)



  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Namaste, {me.name}</h1>
          <p className="muted">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New task</button>
      </header>

      <div className="top-row">
        <Today go={go} />
        <WhosOn />
      </div>

      <RequestBar />

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Needs your attention</h2>
            <span className="muted small desk">Ready to act on, one click each</span>
          </div>
          {!issues.length && !overdue.length && !openRequests.length && <Empty icon="check">All clear.</Empty>}
          <div className="stack">
            {issues.map((i) => {
              const role = ROLES[suggestRole(i.text)].label
              return (
                <div key={i.id} className="attn attn-issue">
                  <span className="desk"><Icon name="flag" /></span>
                  <div className="grow">
                    <div className="attn-title">{i.text}</div>
                    <div className="meta">Reported by {nameOf(s.users, i.by)} · {ago(i.at)}<span className="phone"> · suggest {role}</span></div>
                    <div className="suggest desk"><Icon name="sparkle" size={14} /> Suggested: assign to <b>{role}</b></div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => setConvert(i)}>Create task</button>
                </div>
              )
            })}
            {openRequests.map((m) => (
              <div key={m.id} className="attn attn-request">
                <span className="desk"><Icon name="message" /></span>
                <div className="grow">
                  <div className="attn-title">{m.text}</div>
                  <div className="meta">Request logged {ago(m.at)} · still open</div>
                  {m.verdict && <div className="suggest desk"><Icon name="sparkle" size={14} /> {m.verdict}</div>}
                </div>
                <div className="attn-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => setCreating({ title: `Follow up: ${m.text.slice(0, 50)}`, assignee: { type: 'user', id: me.id }, category: 'Admin & committee', notes: m.text })}>Create task</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => act({ type: 'closeNote', id: m.id, log: 'Closed a request', toast: 'Request closed' })}>Close</button>
                </div>
              </div>
            ))}
            {overdue.map((t) => {
              const days = daysSince(t.due)
              const mine = t.assignee.type === 'user' && t.assignee.id === me.id
              const escalated = days >= 1 && !mine
              return (
                <div key={t.id} className={`attn attn-overdue ${escalated ? 'attn-escalated' : ''}`}>
                  <span className="desk"><Icon name="clock" /></span>
                  <div className="grow">
                    <div className="attn-title">{t.title} {escalated && <Badge tone="red">Overdue {days} day{days > 1 ? 's' : ''}</Badge>}</div>
                    <div className="meta">
                      {assigneeLabel(t.assignee, s.users)} · <span className="red">due {fmtInline(t.due)}</span>
                      {mine ? ' · your own task' : t.remindedAt ? <> · reminded {t.reminders > 1 ? `${t.reminders} times, last ` : ''}{ago(t.remindedAt)}</> : ' · not reminded yet'}
                    </div>
                    {escalated && <div className="suggest desk"><Icon name="sparkle" size={14} /> {t.remindedAt ? 'Still not done after a reminder. Reassign it to someone else?' : 'Send a reminder, or reassign it.'}</div>}
                  </div>
                  <div className="attn-btns">
                    {mine ? (
                      <>
                        <button className="btn btn-sm btn-outline" onClick={() => act({ type: 'complete', id: t.id, log: `Completed "${t.title}"`, toast: 'Marked as done' })}>Mark done</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setReassign(t)}>Reschedule</button>
                      </>
                    ) : <button className="btn btn-sm btn-outline" onClick={() => setReminder(t)}>Remind</button>}
                    {escalated && <button className="btn btn-sm btn-primary" onClick={() => setReassign(t)}>Reassign</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel ai-panel">
          <div className="panel-head">
            <h2><span className="desk"><Icon name="sparkle" size={18} /></span> Today's summary</h2>
            <span className="desk"><Badge tone="blue">AI · demo</Badge></span>
          </div>
          <ul className="summary">
            {summary.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <div className="row">
            <CopyButton text={`Temple summary for ${new Date().toLocaleDateString()}\n\n- ${summary.join('\n- ')}`} label="Copy as email" />
            <span className="muted small desk">Sent to you automatically every evening (planned)</span>
          </div>
          <Automations s={s} overdue={overdue.length} />
        </section>
      </div>

      <div className="grid-2">
        <section className="panel desk">
          <div className="panel-head">
            <h2>Your follow-ups</h2>
            <span className="muted small">{myTasks.length} open</span>
          </div>
          {myTasks.length ? (
            <div className="stack">
              {myTasks.map((t) => (
                <div key={t.id} className="row-item">
                  <button className="tick tick-sm" onClick={() => act({ type: 'complete', id: t.id, log: `Completed "${t.title}"`, toast: 'Marked as done' })} aria-label="Mark done"><Icon name="check" size={16} /></button>
                  <div className="grow">
                    <div>{t.title}</div>
                    <div className="meta">{fmtWhen(t.due)}</div>
                  </div>
                  <StatusBadge task={t} />
                </div>
              ))}
            </div>
          ) : <Empty icon="check">Nothing on your list.</Empty>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Message to all staff</h2></div>
          <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Shows at the top of everyone's task screen" />
          <div className="row end">
            {s.messages[0] && <span className="meta grow">Current: "{s.messages[0].text}" · {ago(s.messages[0].at)}</span>}
            <button className="btn btn-primary" disabled={!msg.trim()} onClick={() => { act({ type: 'announce', text: msg.trim(), log: 'Posted a message to staff', toast: 'Message posted to all staff' }); setMsg('') }}>
              <Icon name="send" size={16} /> Post
            </button>
          </div>
        </section>

      </div>

      {reminder && (
        <SendMessage
          title={`Remind about "${reminder.title}"`}
          draft={reminderText(reminder, s.users, me)}
          recipients={peopleFor(reminder.assignee, s.users)}
          onSent={(how) => act({ type: 'remind', id: reminder.id, log: `Sent a reminder about "${reminder.title}" (${how})` })}
          onClose={() => setReminder(null)}
        />
      )}

      {reassign && (
        <TaskForm
          title={reassign.assignee.type === 'user' && reassign.assignee.id === me.id ? 'Reschedule task' : 'Reassign task'}
          initial={{ ...reassign, due: new Date(Date.now() + 24 * 3600e3).toISOString() }}
          onClose={() => setReassign(null)}
          onSave={(patch) => {
            act({ type: 'updateTask', id: reassign.id, patch: { ...patch, remindedAt: null, reminders: 0 }, log: `Reassigned "${patch.title}" to ${assigneeLabel(patch.assignee, s.users)}`, toast: `Reassigned to ${assigneeLabel(patch.assignee, s.users)}` })
            setReassign(null)
          }}
        />
      )}

      {creating && (
        <TaskForm
          showTemplates={creating === true}
          initial={creating === true ? {} : creating}
          onClose={() => setCreating(false)}
          onSave={(task) => {
            act({ type: 'createTasks', tasks: [task], log: `Assigned "${task.title}"`, toast: `Task sent to ${assigneeLabel(task.assignee, s.users)}` })
            setCreating(false)
          }}
        />
      )}

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

// What the backend will do on its own each day. Simulated here so the client can see the plan.
function Automations({ s, overdue }) {
  const h = new Date().getHours()
  const gap = Object.entries(s.rota).filter(([, ids]) => !ids.length).map(([r]) => ROLES[r].label.toLowerCase())
  const daily = s.tasks.filter((t) => t.kind === 'daily' && isToday(t.due)).length
  const jobs = [
    { at: 6, text: `Created today's ${daily} daily tasks from the checklists` },
    { at: 6, text: gap.length ? `Rota check: no ${gap.join(', ')} today. Alerted you.` : 'Rota check: every role is covered' },
    { at: 7, text: 'Sent each person their task list (app notification)' },
    { at: 9, text: `Overdue check, every hour: ${overdue} overdue, reminders drafted`, repeat: true },
    { at: 18, text: 'Email you the end-of-day summary' },
    { at: 21, text: 'Closing check: alert if safety tasks are not signed off' },
  ]
  return (
    <details className="automations">
      <summary>Automations today <span className="muted small">(simulated until the backend is built)</span></summary>
      <ul>
        {jobs.map((j, i) => {
          const done = j.repeat ? h >= j.at : h >= j.at
          return (
            <li key={i} className={done ? 'done' : ''}>
              <span className="auto-time">{String(j.at).padStart(2, '0')}:00</span>
              <span className="auto-state">{j.repeat && done ? '↻' : done ? '✓' : '○'}</span>
              {j.text}
            </li>
          )
        })}
        <li><span className="auto-time">Mon</span><span className="auto-state">○</span>Weekly report to the president: what went well, what didn't</li>
      </ul>
    </details>
  )
}
