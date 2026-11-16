import { useState } from 'react'
import { ROLES } from '../data'
import { isToday, isOverdue } from '../lib'

// Status colours (validated for colour-blind separation). Every colour is also named in a legend with its count,
// so nothing relies on colour alone.
export const STATUS = [
  { id: 'done', label: 'Done', color: '#2f7a4d' },
  { id: 'waiting', label: 'Waiting for sign-off', color: '#d9a13b' },
  { id: 'todo', label: 'To do', color: '#4a7fc0' },
  { id: 'overdue', label: 'Overdue / problem', color: '#b4321f' },
]

export function bucket(t) {
  if (t.status === 'done' || t.status === 'verified') return 'done'
  if (t.status === 'awaiting') return 'waiting'
  if (t.status === 'flagged' || isOverdue(t)) return 'overdue'
  return 'todo'
}

const count = (tasks) => {
  const c = { done: 0, waiting: 0, todo: 0, overdue: 0 }
  tasks.forEach((t) => c[bucket(t)]++)
  return c
}

function useTip() {
  const [tip, setTip] = useState(null)
  const show = (e, text) => {
    const box = e.currentTarget.closest('.chart').getBoundingClientRect()
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text })
  }
  const el = tip && <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>
  return { show, hide: () => setTip(null), el }
}

// One segmented bar: segments are separated by 2px gaps, outer ends rounded.
function Segments({ c, total, scale = 1, tip, label }) {
  const parts = STATUS.filter((s) => c[s.id] > 0)
  return (
    <div className="seg-bar" style={{ width: `${scale * 100}%` }}>
      {parts.map((s) => (
        <span
          key={s.id}
          className="seg-part"
          style={{ flexGrow: c[s.id], background: s.color }}
          onMouseMove={(e) => tip.show(e, `${label ? label + ' · ' : ''}${s.label}: ${c[s.id]} of ${total}`)}
          onMouseLeave={tip.hide}
        />
      ))}
    </div>
  )
}

function Legend({ c }) {
  return (
    <ul className="legend">
      {STATUS.map((s) => (
        <li key={s.id}>
          <span className="swatch" style={{ background: s.color }} />
          {s.label} <b>{c[s.id]}</b>
        </li>
      ))}
    </ul>
  )
}

export function TodayProgress({ tasks }) {
  const tip = useTip()
  const today = tasks.filter((t) => isToday(t.due) || isOverdue(t))
  const c = count(today)
  const pct = today.length ? Math.round(((c.done + c.waiting) / today.length) * 100) : 0
  return (
    <div className="chart">
      <div className="hero">
        <span className="hero-num">{pct}%</span>
        <span className="muted">of today's {today.length} tasks finished</span>
      </div>
      <Segments c={c} total={today.length} tip={tip} />
      <Legend c={c} />
      {tip.el}
    </div>
  )
}

export function ByRole({ tasks, users }) {
  const tip = useTip()
  const today = tasks.filter((t) => isToday(t.due) || isOverdue(t))
  const roleOf = (t) => (t.assignee.type === 'role' ? t.assignee.id : users.find((u) => u.id === t.assignee.id)?.role)
  const rows = Object.keys(ROLES)
    .filter((r) => ROLES[r].group !== 'admin')
    .map((r) => {
      const list = today.filter((t) => roleOf(t) === r)
      return { r, c: count(list), total: list.length }
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.c.overdue - a.c.overdue || b.total - a.total)
  const max = Math.max(...rows.map((x) => x.total), 1)

  return (
    <div className="chart">
      <div className="role-rows">
        {rows.map(({ r, c, total }) => (
          <div key={r} className="role-row">
            <span className="role-name">{ROLES[r].label}</span>
            <div className="role-track">
              <Segments c={c} total={total} scale={total / max} tip={tip} label={ROLES[r].label} />
              <span className="role-total">{c.done + c.waiting}/{total}{c.overdue > 0 && <span className="red"> · {c.overdue} late</span>}</span>
            </div>
          </div>
        ))}
      </div>
      {tip.el}
    </div>
  )
}

// Completion rate per day. Past days are sample data until the backend stores history; today is live.
export function WeekTrend({ history, tasks }) {
  const tip = useTip()
  const today = tasks.filter((t) => isToday(t.due) || isOverdue(t))
  const c = count(today)
  const todayPct = today.length ? Math.round(((c.done + c.waiting) / today.length) * 100) : 0
  const days = [...history, { date: new Date().toLocaleDateString('en-CA'), pct: todayPct, live: true }]
  const H = 120

  return (
    <div className="chart">
      <div className="week">
        <div className="week-grid" style={{ height: H }}>
          <span style={{ bottom: H }}>100%</span>
          <span style={{ bottom: H / 2 }}>50%</span>
        </div>
        {days.map((d) => {
          const label = new Date(`${d.date}T00:00`).toLocaleDateString([], { weekday: 'short' })
          return (
            <div
              key={d.date}
              className="week-col"
              onMouseMove={(e) => tip.show(e, `${new Date(`${d.date}T00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}: ${d.pct}% finished${d.live ? ' (so far)' : ''}`)}
              onMouseLeave={tip.hide}
            >
              <div className="week-bar-wrap" style={{ height: H }}>
                {d.live && <span className="week-val">{d.pct}%</span>}
                <span className={`week-bar ${d.live ? 'live' : ''}`} style={{ height: `${Math.max(d.pct, 2)}%` }} />
              </div>
              <span className={`week-day ${d.live ? 'strong' : ''}`}>{d.live ? 'Today' : label}</span>
            </div>
          )
        })}
      </div>
      {tip.el}
    </div>
  )
}
