import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { attendanceApi, issuesApi, tasksApi } from '../api/endpoints'
import { toDateInput } from '../lib/format'
import { assigneeLabel } from '../lib/tasks'
import { Icon, Modal } from './ui'

// AI1 Ask AI (design: screens/32_AI1): a side panel on every admin page (⌘K).
// Phase 3 connects Temple AI (Claude). Until then it answers the common questions
// straight from live data, and says so; it never makes anything up.

interface Message { from: 'me' | 'ai'; text: string; body?: ReactNode; source?: string }

const QUESTIONS = ['Who attended this week?', 'Who is on site right now?', 'What is still not done today?', 'Which safety checks are waiting?', 'What problems are open?']
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Any time')

async function answer(question: string): Promise<Message> {
  const q = question.toLowerCase()

  if (/week|attended|attendance/.test(q)) {
    // Monday of this week to today
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const days: Date[] = []
    for (const d = new Date(monday); d <= today; d.setDate(d.getDate() + 1)) days.push(new Date(d))
    const results = await Promise.all(days.map((d) => attendanceApi.day(toDateInput(d))))
    const names = new Map<number, string>()
    results.forEach((r) => r.people.forEach((p) => names.set(p.user_id, p.full_name)))
    const rows = [...names.entries()].map(([id, name]) => {
      const states = results.map((r) => r.people.find((p) => p.user_id === id)?.state ?? 'not_in')
      return { name, states, total: states.filter((s) => s === 'here' || s === 'left').length }
    }).sort((a, b) => b.total - a.total)
    const present = rows.reduce((n, r) => n + r.total, 0)
    const possible = rows.length * days.length
    return {
      from: 'ai',
      text: `This week so far (${days[0].toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} to today): ${present} of ${possible} staff days, so ${possible ? Math.round((present / possible) * 100) : 0}%.`,
      body: (
        <table className="ai-table">
          <thead><tr><th>Name</th>{days.map((d) => <th key={d.toISOString()}>{d.toLocaleDateString([], { weekday: 'short' })}</th>)}<th>Total</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                {r.states.map((s, i) => <td key={i}><i className={`ai-dot ${s === 'here' || s === 'left' ? 'on' : s === 'absent' ? 'off' : ''}`} /></td>)}
                <td>{r.total}/{days.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
      source: `From: Attendance · live, ${now()}`,
    }
  }

  if (/site|here|checked in|who.*in/.test(q)) {
    const d = await attendanceApi.day()
    const here = d.people.filter((p) => p.state === 'here')
    const notIn = d.people.filter((p) => p.state === 'not_in')
    return {
      from: 'ai',
      text: here.length ? `${here.length} ${here.length === 1 ? 'person is' : 'people are'} on site right now.` : 'Nobody is checked in right now.',
      body: (
        <ul className="ai-list">
          {here.map((p) => <li key={p.user_id}><b>{p.full_name}</b> · since {hhmm(p.check_in!)}</li>)}
          {notIn.length > 0 && <li className="muted">Not in yet: {notIn.map((p) => p.full_name.split(' ')[0]).join(', ')}</li>}
        </ul>
      ),
      source: `From: Attendance · live, ${now()}`,
    }
  }

  if (/safety|sign/.test(q)) {
    const r = await tasksApi.signoffs()
    return {
      from: 'ai',
      text: r.tasks.length ? `${r.tasks.length} safety ${r.tasks.length === 1 ? 'task is' : 'tasks are'} done and waiting for a second check.` : 'No safety checks are waiting.',
      body: <ul className="ai-list">{r.tasks.map((t) => <li key={t.id}><b>{t.title}</b> · done by {t.completed_by_name}</li>)}</ul>,
      source: `From: Tasks · live, ${now()}`,
    }
  }

  if (/problem|issue|broken|report/.test(q)) {
    const r = await issuesApi.list('open')
    return {
      from: 'ai',
      text: r.issues.length ? `${r.issues.length} reported ${r.issues.length === 1 ? 'problem is' : 'problems are'} still open.` : 'No open problems. Everything reported has been sorted.',
      body: <ul className="ai-list">{r.issues.map((i) => <li key={i.id}><b>{i.description}</b> · {i.reported_by_name}</li>)}</ul>,
      source: `From: Action Center · live, ${now()}`,
    }
  }

  if (/done|todo|to do|left|not done|task/.test(q)) {
    const r = await tasksApi.list({ view: 'today' })
    const todo = r.tasks.filter((t) => t.status === 'todo')
    return {
      from: 'ai',
      text: todo.length ? `${todo.length} of today's ${r.tasks.length} tasks are not done yet.` : `All ${r.tasks.length} of today's tasks are done.`,
      body: <ul className="ai-list">{todo.map((t) => <li key={t.id} className={t.is_overdue ? 'red' : ''}><b>{hhmm(t.due_at)} {t.title}</b> · {assigneeLabel(t)}{t.is_overdue ? ' · late' : ''}</li>)}</ul>,
      source: `From: Tasks · live, ${now()}`,
    }
  }

  return {
    from: 'ai',
    text: "I can't answer that yet. Temple AI is connected in Phase 3; for now I can answer the questions below from live data.",
  }
}

export default function AskAiPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  // Braces matter: newer browsers return a promise from scrollIntoView, and React effects must not return one.
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const ask = async (question: string) => {
    if (!question.trim() || busy) return
    setInput('')
    setMessages((m) => [...m, { from: 'me', text: question.trim() }])
    setBusy(true)
    try {
      const reply = await answer(question)
      setMessages((m) => [...m, reply])
    } catch (err) {
      setMessages((m) => [...m, { from: 'ai', text: `Sorry, I couldn't fetch that: ${(err as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); ask(input) }

  return (
    <Modal
      title="Ask AI"
      size="drawer"
      onClose={onClose}
      head={
        <div className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
          <span className="tile-ic ic-saf"><span className="star" style={{ fontSize: 20 }}>✦</span></span>
          <div><h2 style={{ fontSize: 20 }}>Ask AI</h2><p className="modal-sub" style={{ marginTop: 0 }}>Answers from your temple's live data</p></div>
        </div>
      }
      footer={
        <form className="ai-input" onSubmit={submit}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about the temple…" aria-label="Ask a question" autoFocus />
          <button className="btn btn-primary" disabled={!input.trim() || busy} aria-label="Send"><Icon name="arrow-right" size={18} /></button>
          <span className="ai-note">Preview: answers come straight from live data. Temple AI (Claude) joins in Phase 3.</span>
        </form>
      }
    >
      {!messages.length && (
        <div className="ai-empty">
          <span className="tile-ic ic-saf" style={{ width: 56, height: 56 }}><span className="star" style={{ fontSize: 26 }}>✦</span></span>
          <b>What would you like to know?</b>
          <span className="muted">Answers only use what you're allowed to see.</span>
        </div>
      )}
      {messages.map((m, i) => m.from === 'me' ? (
        <div key={i} className="ai-me">{m.text}</div>
      ) : (
        <div key={i} className="ai-msg">
          <span className="tile-ic ic-saf ai-av"><span className="star">✦</span></span>
          <div className="grow">
            <p>{m.text}</p>
            {m.body}
            {m.source && <span className="ai-src">{m.source}</span>}
          </div>
        </div>
      ))}
      {busy && <div className="ai-msg"><span className="tile-ic ic-saf ai-av"><span className="star">✦</span></span><p className="muted">Looking…</p></div>}
      <div className="chips">
        {QUESTIONS.map((q) => <button key={q} type="button" className="chip" onClick={() => ask(q)} disabled={busy}>{q}</button>)}
      </div>
      <div ref={end} />
    </Modal>
  )
}
