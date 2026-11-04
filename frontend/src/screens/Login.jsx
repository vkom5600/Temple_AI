import { useStore } from '../store.jsx'
import { GROUPS, ROLES } from '../data'
import { Avatar } from '../ui.jsx'

// Demo login: pick a person. The real version would use a simple PIN per person on the shared tablet.
export default function Login() {
  const { s, act } = useStore()
  const groups = Object.keys(GROUPS)
  return (
    <div className="login">
      <div className="login-inner">
        <div className="brand">
          <span className="brand-mark">ॐ</span>
          <div>
            <div className="brand-name">VHP Ilford Temple</div>
            <div className="brand-sub">Daily operations</div>
          </div>
        </div>
        <h1 className="login-title">Who is using the app?</h1>
        <p className="muted">Tap your name. (Prototype: no passwords yet.)</p>
        {groups.map((g) => {
          const people = s.users.filter((u) => ROLES[u.role]?.group === g)
          if (!people.length) return null
          return (
            <section key={g} className="login-group">
              <h2 className="eyebrow">{GROUPS[g]}</h2>
              <div className="people-grid">
                {people.map((u) => (
                  <button key={u.id} className="person" onClick={() => act({ type: 'login', id: u.id })}>
                    <Avatar user={u} size={44} />
                    <span className="person-name">{u.name}</span>
                    <span className="person-role">{ROLES[u.role].label}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
