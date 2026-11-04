import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { RULES } from '../data'
import { answer } from '../assistant'
import { nameOf, ago } from '../lib'
import { Icon, Badge } from '../ui.jsx'
import { Connection } from './Bookings.jsx'

const EXAMPLES = [
  'A member wants to set up a stall in the mandir. Is that OK?',
  "What's overdue?",
  'Give me today’s summary',
  'Someone wants to hire the hall for a party',
]

export default function Assistant() {
  const { s, me, act } = useStore()
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [s.chat.length])

  const ask = (question) => {
    const qq = question.trim()
    if (!qq) return
    const a = answer(qq, s)
    act({ type: 'chat', msgs: [{ role: 'user', text: qq }, { role: 'ai', ...a }] })
    setQ('')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Assistant</h1>
          <p className="muted">Ask about a request, the rules, or what's pending. It answers only from the temple's own rules, notes and task data.</p>
        </div>
        <Badge tone="blue">Demo: real AI connects later</Badge>
      </header>

      <div className="toolbar">
        <span className="muted small">Answers from: sample rules, your notes, task data</span>
        <Connection name="SharePoint documents" note="Will read the temple's rules and policies from SharePoint once they are uploaded and the backend is built." />
      </div>

      <div className="assistant">
        <section className="panel chat">
          <div className="chat-log">
            {!s.chat.length && (
              <div className="chat-empty">
                <Icon name="sparkle" size={22} />
                <p>Try one of these:</p>
                <div className="chips">
                  {EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => ask(e)}>{e}</button>)}
                </div>
              </div>
            )}
            {s.chat.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                <div className="bubble-text">{m.text}</div>
                {m.sources?.length > 0 && <div className="sources">Based on: {m.sources.join(', ')}</div>}
                {m.action && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => act({ type: 'createTasks', tasks: [{ title: m.action.title, assignee: { type: 'user', id: me.id }, area: 'Whole compound', due: new Date(Date.now() + 24 * 3600e3).toISOString(), kind: 'one-off' }], log: 'Added a follow-up from the assistant', toast: 'Added to your follow-ups' })}
                  >
                    <Icon name="plus" size={14} /> {m.action.label}
                  </button>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question or paste a request you received…" />
            <button className="btn btn-primary" disabled={!q.trim()}><Icon name="send" size={16} /> Ask</button>
          </form>
        </section>

        <aside className="stack">
          <section className="panel">
            <div className="panel-head"><h2><Icon name="book" size={16} /> Temple notes</h2></div>
            <p className="muted small">Things the assistant should remember, like requests, decisions and promises.</p>
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { act({ type: 'addMemory', text: note.trim(), log: 'Added a note to temple memory', toast: 'Saved to temple notes' }); setNote('') } }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diwali committee meeting moved to Thursday" />
              <button className="btn btn-outline" disabled={!note.trim()}>Save</button>
            </form>
            <ul className="notes">
              {s.memory.map((m) => <li key={m.id}>{m.text} <span className="muted small">· {nameOf(s.users, m.by)}, {ago(m.at)}</span></li>)}
            </ul>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Rules it uses</h2><Badge tone="amber">Sample</Badge></div>
            <p className="muted small">Placeholders until the temple's real policies are uploaded.</p>
            <ul className="rules">
              {RULES.map((r) => <li key={r.id}><b>{r.id} · {r.title}.</b> {r.text}</li>)}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
