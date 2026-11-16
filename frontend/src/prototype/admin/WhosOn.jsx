import { useStore } from '../store.jsx'
import { ROLES } from '../data'
import { fmtTime } from '../lib'
import { Avatar } from '../ui.jsx'

// Side panel: today's rota and who has checked in. A role with nobody on it shows as a red gap.
export default function WhosOn() {
  const { s } = useStore()
  const rows = Object.entries(s.rota).flatMap(([role, ids]) =>
    ids.length ? ids.map((id) => ({ role, user: s.users.find((u) => u.id === id) })) : [{ role, user: null }],
  )
  const here = rows.filter((r) => r.user && s.checkins[r.user.id]).length
  const onRota = rows.filter((r) => r.user).length

  return (
    <section className="panel whos-on">
      <div className="panel-head">
        <h2>Who's on today</h2>
        <span className="muted small">{here}/{onRota} here</span>
      </div>
      <div className="stack-tight">
        {rows.map(({ role, user }) =>
          user ? (
            <div key={user.id} className="whos-row">
              <Avatar user={user} size={30} />
              <div className="grow">
                <div>{user.name}</div>
                <div className="meta">{ROLES[role].label}</div>
              </div>
              {s.checkins[user.id]
                ? <span className="here">{fmtTime(s.checkins[user.id])}</span>
                : <span className="muted small">Not yet</span>}
            </div>
          ) : (
            <div key={role} className="whos-row whos-gap">
              <span className="gap-mark">!</span>
              <div className="grow">
                <div>No {ROLES[role].label.toLowerCase()} today</div>
                <div className="meta">{role === 'volunteer' ? 'Nobody to sign off safety tasks' : 'This role is not covered'}</div>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
