import { useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES } from '../data'
import { fmtInline, tasksForUser, isToday, isOverdue, isFinished, nameOf, fmtTime, fmtDay, ago, eventsToday, observanceToday } from '../lib'
import { Icon, Badge, Avatar, Empty } from '../ui.jsx'
import ProblemSheet from './ProblemSheet.jsx'
import VerifyList from './VerifyList.jsx'

// Mobile-first, deliberately minimal: a message, a tick list, and one way to report a problem.
export default function StaffHome() {
  const { s, me, act } = useStore()
  const [tab, setTab] = useState('tasks')
  const [problem, setProblem] = useState(null) // task or 'general'
  const isVol = me.role === 'volunteer'

  const mine = tasksForUser(s.tasks, me)
  const order = (a, b) => (isFinished(a) - isFinished(b)) || (new Date(a.due) - new Date(b.due))
  const today = mine.filter((t) => isToday(t.due) || isOverdue(t)).sort(order)
  const later = mine.filter((t) => !today.includes(t) && new Date(t.due) > new Date()).sort(order)
  const done = today.filter(isFinished).length
  const msg = s.messages[0]
  const toVerify = s.tasks.filter((t) => t.status === 'awaiting').length
  const here = s.checkins[me.id]
  const obs = observanceToday(s)
  const events = eventsToday(s)

  return (
    <div className="mobile">
      <header className="m-head">
        <div className="row">
          <Avatar user={me} size={40} />
          <div>
            <div className="m-hello">Namaste, {me.name}</div>
            <div className="muted small">{ROLES[me.role].label}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => act({ type: 'logout' })} aria-label="Log out"><Icon name="logout" /></button>
      </header>

      <section className={`day-hero day-${partOfDay()}`}>
        <Mandala />
        <div className="day-top">
          <span className="day-date">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          {here ? (
            <span className="glass-pill"><Icon name="check" size={14} /> Here {fmtTime(here)}</span>
          ) : (
            <button className="glass-pill glass-btn" onClick={() => act({ type: 'checkIn', log: 'Checked in', toast: 'Thank you. You are checked in.' })}>I'm here</button>
          )}
        </div>
        <h1 className="day-title">{obs ? obs.name : greeting()}</h1>
        <div className="day-events">
          {events.length ? events.map((e) => (
            <span key={e.id} className={`glass-pill ${e.state === 'finished' ? 'past' : ''}`}>
              <b>{e.start}</b> {e.title}{e.state === 'on' && <span className="live" />}
            </span>
          )) : <span className="day-quiet">No events today</span>}
        </div>
      </section>


      {isVol && (
        <div className="seg">
          <button className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>My tasks</button>
          <button className={tab === 'verify' ? 'on' : ''} onClick={() => setTab('verify')}>
            Sign-offs {toVerify > 0 && <span className="count">{toVerify}</span>}
          </button>
        </div>
      )}

      {tab === 'verify' ? (
        <section className="m-section">
          <p className="muted">These safety tasks are done. Please go and check, then sign off.</p>
          <VerifyList compact />
        </section>
      ) : (
        <>
          {msg && (
            <div className="notice">
              <Icon name="message" size={18} />
              <div>
                <div className="notice-from">Message from {nameOf(s.users, msg.by)} · {ago(msg.at)}</div>
                <div>{msg.text}</div>
              </div>
            </div>
          )}

          <section className="m-section">
            <div className="progress-row">
              <h2>Today</h2>
              <span className="muted">{done} of {today.length} done</span>
            </div>
            <div className="progress"><span style={{ width: `${today.length ? (done / today.length) * 100 : 0}%` }} /></div>
            {today.length ? (
              <div className="stack">
                {today.map((t) => <TaskCard key={t.id} t={t} onProblem={() => setProblem(t)} />)}
              </div>
            ) : (
              <Empty icon="check">No tasks today.</Empty>
            )}
          </section>

          {later.length > 0 && (
            <section className="m-section">
              <h2>Coming up</h2>
              <div className="stack">
                {later.map((t) => (
                  <div key={t.id} className="card later">
                    <div className="task-title">{t.title}</div>
                    <div className="meta">{fmtDay(t.due)}, {fmtTime(t.due)} · {t.area}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button className="btn btn-outline btn-block btn-lg report-btn" onClick={() => setProblem('general')}>
            <Icon name="alert" /> Report a problem
          </button>
        </>
      )}

      {problem && <ProblemSheet task={problem === 'general' ? null : problem} onClose={() => setProblem(null)} />}
    </div>
  )
}

const partOfDay = () => {
  const h = new Date().getHours()
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
}
const greeting = () => ({ morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' })[partOfDay()]

// Decorative lotus-mandala, drawn in code so there's no image to load.
function Mandala() {
  const petals = (n, r, rx, ry) => Array.from({ length: n }, (_, i) => (
    <ellipse key={`${r}-${i}`} cx="0" cy={-r} rx={rx} ry={ry} transform={`rotate(${(360 / n) * i})`} />
  ))
  return (
    <svg className="mandala" viewBox="-100 -100 200 200" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle r="96" /><circle r="78" /><circle r="14" />
        {petals(16, 60, 10, 24)}
        {petals(8, 32, 9, 18)}
      </g>
    </svg>
  )
}

function TaskCard({ t, onProblem }) {
  const { s, act } = useStore()
  const overdue = isOverdue(t)
  const finished = isFinished(t)

  const complete = () =>
    act({
      type: 'complete',
      id: t.id,
      log: `Completed "${t.title}"`,
      toast: t.critical ? 'Done. A volunteer will check and sign off.' : 'Marked as done',
    })

  return (
    <div className={`card task ${finished ? 'finished' : ''} ${overdue ? 'overdue' : ''} ${t.status === 'flagged' ? 'flagged' : ''}`}>
      <button
        className={`tick ${finished ? 'on' : ''}`}
        onClick={finished || t.status === 'flagged' ? undefined : complete}
        disabled={finished || t.status === 'flagged'}
        aria-label={finished ? 'Done' : `Mark "${t.title}" as done`}
      >
        <Icon name="check" size={26} />
      </button>
      <div className="task-body">
        <div className="task-title">{t.title}</div>
        <div className="meta">
          {overdue ? <b className="red">Was due {fmtInline(t.due)}</b> : fmtTime(t.due)} · {t.area}
        </div>
        <div className="badges">
          {t.critical && t.status === 'todo' && <Badge tone="amber">Needs a second check</Badge>}
          {t.status === 'awaiting' && <Badge tone="amber">Done · waiting for sign-off</Badge>}
          {t.status === 'verified' && <Badge tone="green">Signed off by {nameOf(s.users, t.verifiedBy)}</Badge>}
          {t.status === 'flagged' && <Badge tone="red">Reported: {t.comments.at(-1)?.text}</Badge>}
        </div>
        {t.status === 'todo' && t.comments.at(-1)?.text.startsWith('Sent back') && (
          <div className="sentback">{t.comments.at(-1).text}</div>
        )}
        {t.status === 'todo' && (
          <button className="link-btn" onClick={onProblem}><Icon name="flag" size={14} /> Can't do this?</button>
        )}
        {(t.status === 'done' || t.status === 'awaiting') && (
          <button className="link-btn muted" onClick={() => act({ type: 'undo', id: t.id })}><Icon name="undo" size={14} /> Undo</button>
        )}
      </div>
    </div>
  )
}
