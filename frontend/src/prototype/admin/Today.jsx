import { useStore } from '../store.jsx'
import { isToday, isOverdue, isFinished, fmtTime, eventsToday, clashes, comingUp, observanceToday } from '../lib'

// Hero module: the day's headline, one progress ring, and lanes that sit side by side on desktop and swipe on a phone.
export default function Today({ go }) {
  const { s } = useStore()

  const today = s.tasks.filter((t) => isToday(t.due) || isOverdue(t))
  const done = today.filter((t) => t.status === 'done' || t.status === 'verified').length
  const awaiting = today.filter((t) => t.status === 'awaiting').length
  const overdue = today.filter(isOverdue).length
  const issues = s.issues.filter((i) => i.status === 'open').length

  const checks = today.filter((t) => !t.critical && t.kind !== 'booking')
  const safety = today.filter((t) => t.critical)
  const nextOf = (list) => list.filter((t) => t.status === 'todo').sort((a, b) => new Date(a.due) - new Date(b.due))[0]

  const events = eventsToday(s)
  const upcoming = comingUp(s)
  const obs = observanceToday(s)
  const nextTask = nextOf(today)

  return (
    <section className="today">
      <div className="today-top">
        <Ring total={today.length} done={done} awaiting={awaiting} />
        <div className="grow">
          {obs && <div className="eyebrow">{obs.name}{obs.sample && <span className="sample">sample</span>}</div>}
          <Headline events={events} obs={obs} upcoming={upcoming} nextTask={nextTask} />
          <div className="today-flags">
            {overdue > 0 && <button className="pill pill-red" onClick={() => go('tasks', 'overdue')}>{overdue} overdue</button>}
            {issues > 0 && <button className="pill pill-red" onClick={() => go('issues')}>{issues} open {issues === 1 ? 'issue' : 'issues'}</button>}
            {awaiting > 0 && <button className="pill pill-amber" onClick={() => go('signoffs')}>{awaiting} waiting for sign-off</button>}
          </div>
        </div>
      </div>

      <div className="swipe lanes">
        <Lane title="Daily checks" value={checks.filter(isFinished).length} total={checks.length} next={nextOf(checks)} onClick={() => go('tasks', 'all')} />
        <Lane
          title="Safety & closing"
          value={safety.filter((t) => t.status === 'verified').length}
          total={safety.length}
          tone="amber"
          note={awaiting > 0 ? `${awaiting} done, needs a second check` : 'Signed off by a second person'}
          next={nextOf(safety)}
          onClick={() => go('signoffs')}
        />
        <EventsLane events={events} upcoming={upcoming} onClick={() => go('bookings')} />
      </div>
    </section>
  )
}

function Headline({ events, obs, upcoming, nextTask }) {
  const live = events.filter((e) => e.state !== 'finished')
  if (events.length > 1) {
    return (
      <>
        <h2 className="today-headline">{events.length} events today</h2>
        <div className="muted">{live.length ? `Next: ${live[0].title} at ${live[0].start}` : 'All finished for today'}</div>
      </>
    )
  }
  if (events.length === 1) {
    const e = events[0]
    return (
      <>
        <h2 className="today-headline">{e.title}</h2>
        <div className="muted">{e.space} · {e.start}–{e.end}{e.state === 'on' ? ' · on now' : e.state === 'finished' ? ' · finished' : ''}</div>
      </>
    )
  }
  if (obs) {
    return (
      <>
        <h2 className="today-headline">{obs.name}</h2>
        <div className="muted">No hall bookings today{upcoming[0] ? ` · next: ${upcoming[0].title}, ${upcoming[0].when.toLowerCase()}` : ''}</div>
      </>
    )
  }
  return (
    <>
      <h2 className="today-headline">{nextTask ? `Next: ${nextTask.title}` : 'A quiet day. Everything is done.'}</h2>
      <div className="muted">
        {nextTask ? `${nextTask.area} · ${fmtTime(nextTask.due)}` : ''}
        {upcoming[0] ? `${nextTask ? ' · ' : ''}Coming up: ${upcoming[0].title}, ${upcoming[0].when.toLowerCase()}` : ''}
      </div>
    </>
  )
}

// Fixed-size list so 1 event or 6 events take the same space: up to 3 rows today, then what's coming up.
function EventsLane({ events, upcoming, onClick }) {
  const shown = events.slice(0, 3)
  const label = (e) => ({ finished: 'done', on: 'on now' }[e.state])
  return (
    <button className="lane" onClick={onClick}>
      <div className="lane-head">
        <span className="lane-title">Events</span>
        <span className="lane-num">{events.length} <small>today</small></span>
      </div>
      <div className="lane-list">
        {shown.map((e) => (
          <div key={e.id} className={e.state === 'finished' ? 'past' : ''}>
            <b>{e.start}</b> {e.title}{label(e) && <span className="muted"> · {label(e)}</span>}
          </div>
        ))}
        {events.length > 3 && <div className="muted">+{events.length - 3} more today</div>}
        {clashes(events) && <div className="red strong">Two events overlap in one space</div>}
      </div>
      {upcoming.length > 0 && (
        <div className="lane-list lane-sub">
          <span className="lane-label">Coming up</span>
          {upcoming.map((u) => (
            <div key={u.id} className={u.festival ? 'festival' : ''}><b>{u.when}</b> {u.title}</div>
          ))}
        </div>
      )}
    </button>
  )
}

function Lane({ title, value, total, next, note, tone = 'green', onClick }) {
  const pct = total ? (value / total) * 100 : 0
  return (
    <button className="lane" onClick={onClick}>
      <div className="lane-head">
        <span className="lane-title">{title}</span>
        <span className="lane-num">{value}<small>/{total}</small></span>
      </div>
      <div className={`lane-bar lane-${tone}`}><span style={{ width: `${pct}%` }} /></div>
      <div className="lane-next">
        {next ? <>Next: {next.title} · <b>{fmtTime(next.due)}</b></> : note || 'All done'}
      </div>
    </button>
  )
}

function Ring({ total, done, awaiting }) {
  const r = 46
  const c = 2 * Math.PI * r
  const dLen = total ? (done / total) * c : 0
  const aLen = total ? (awaiting / total) * c : 0
  return (
    <div className="ring" role="img" aria-label={`${done} of ${total} tasks done, ${awaiting} waiting for sign-off`}>
      <svg viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} className="ring-track" />
        <circle cx="55" cy="55" r={r} className="ring-amber" strokeDasharray={`${aLen} ${c}`} strokeDashoffset={-dLen} />
        <circle cx="55" cy="55" r={r} className="ring-green" strokeDasharray={`${dLen} ${c}`} />
      </svg>
      <div className="ring-label">
        <span className="ring-num">{done}<small>/{total}</small></span>
        <span className="ring-sub">done</span>
      </div>
    </div>
  )
}
