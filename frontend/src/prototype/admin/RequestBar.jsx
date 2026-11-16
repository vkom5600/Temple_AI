import { useState } from 'react'
import { useStore } from '../store.jsx'
import { answer } from '../assistant'
import { Icon, Badge } from '../ui.jsx'

// "On the entering of the data it should give a proper answer": type a request, get the verdict from
// the temple's own rules straight away, then save it (it resurfaces until closed) and/or make a task.
export default function RequestBar() {
  const { me, s, act } = useStore()
  const [q, setQ] = useState('')
  const [result, setResult] = useState(null)

  const check = (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setResult({ q: q.trim(), ...answer(q.trim(), s) })
  }
  const reset = () => { setResult(null); setQ('') }
  const save = (withTask) => {
    act({ type: 'logRequest', text: result.q, verdict: result.text.split('\n')[0], log: 'Logged a request', toast: withTask ? 'Saved, and added to your follow-ups' : "Saved. I'll bring it back if it's still open tomorrow." })
    if (withTask) {
      act({ type: 'createTasks', tasks: [{ title: `Reply about: ${result.q.slice(0, 60)}`, assignee: { type: 'user', id: me.id }, area: 'Whole compound', due: new Date(Date.now() + 24 * 3600e3).toISOString(), kind: 'one-off', category: 'Admin & committee', notes: result.text }] })
    }
    reset()
  }

  return (
    <section className="panel request-bar">
      <form className="request-form" onSubmit={check}>
        <Icon name="sparkle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Log a request, e.g. “A member wants to set up a stall in the mandir”" />
        <button className="btn btn-primary" disabled={!q.trim()}>Check</button>
      </form>
      {result && (
        <div className="request-result">
          <div className="row">
            <b>{result.sources.length ? 'From the temple rules' : 'Not covered by the rules'}</b>
            <Badge tone="blue">AI · demo</Badge>
            {result.sources.length > 0 && <span className="muted small">{result.sources.join(', ')}</span>}
          </div>
          <p className="request-text">{result.text}</p>
          <div className="row">
            <button className="btn btn-sm btn-primary" onClick={() => save(true)}>Save + add a follow-up for me</button>
            <button className="btn btn-sm btn-outline" onClick={() => save(false)}>Just save it</button>
            <button className="btn btn-sm btn-ghost" onClick={reset}>Dismiss</button>
          </div>
        </div>
      )}
    </section>
  )
}
