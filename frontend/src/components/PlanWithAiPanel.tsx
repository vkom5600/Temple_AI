import { useEffect, useRef, useState, type FormEvent } from 'react'
import { plansApi, resourcesApi, usersApi } from '../api/endpoints'
import { TASK_GROUP_LABELS } from '../constants'
import { toDateInput, toTimeInput } from '../lib/format'
import { useToast } from './Toast'
import { ErrorNote, Icon, Modal, type IconName } from './ui'
import type { PlanDraft, PlanEvent, PlanNote, PlanTask, Resource, TaskGroup, User } from '../types'
import { ukDay, ukFromInputs, ukTime } from '../lib/uk'

// AI2 Plan with AI (designs: screens/07 chat, 08 draft plan, 09 plan from last year).
//  07: describe the event; it asks what's missing, flags rule problems, and offers
//      tasks as tick-box cards ("Add 3 to plan", "Change who"). The bar shows the draft.
//  08: the draft: the calendar event and its tasks, each editable. Confirm plan.
//  09: when there was a similar event before, its jobs moved to the new date.
// Nothing is added until you confirm. Rule-based for now (checks the halls,
// clashes and Temple Rules); Temple AI (Claude) takes over the same steps in Phase 3b.

type Section = 'space' | 'event' | 'crowd' | 'last_time'
type SuggestedTask = PlanTask & { section?: Section; picked?: boolean }
interface Suggestion { section: Section; tasks: SuggestedTask[]; state: 'open' | 'added' | 'skipped'; changingWho: boolean }
interface Message { from: 'me' | 'ai'; text: string; notes?: PlanNote[]; suggestions?: Suggestion[]; lastTime?: boolean }
interface Plan { event: PlanEvent; tasks: PlanTask[]; notes: PlanNote[]; based_on: PlanDraft['based_on']; lastTimeTasks: PlanTask[] }

const IDEAS = [
  'Navratri garba night, 300 people, Sat 12 Dec',
  'Satyanarayan puja for the Patel family, next Sunday 11am',
  'Community dinner, 80 people, next Saturday 6pm',
]

// Dates and times as in the designs: "Sat 14 Nov", "18:00"
const dayLabel = (iso: string) => ukDay(new Date(iso))
const hhmm = (iso: string) => ukTime(new Date(iso))
const join = (date: string, time: string) => ukFromInputs(date, time).toISOString()
const whoKey = (t: Pick<PlanTask, 'assigned_to' | 'assigned_group'>) => (t.assigned_group ? `group:${t.assigned_group}` : `user:${t.assigned_to}`)
const strip = ({ section: _s, picked: _p, ...t }: SuggestedTask): PlanTask => t

// An icon for each job, like the design's traffic light, signs and megaphone
const taskIcon = (t: PlanTask): IconName => {
  const s = t.title.toLowerCase()
  if (t.requires_verification || /lock|security|fire|first aid/.test(s)) return 'shield'
  if (/car|gate|parking/.test(s) && !/notice/.test(s)) return 'car'
  if (/cone|sign/.test(s)) return 'cone'
  if (/tell|notice|announce|agenda|invite|devotees/.test(s)) return 'megaphone'
  if (/clean|clear/.test(s)) return 'broom'
  if (/prasad|cook|food|serve|kitchen|meal/.test(s)) return 'pot'
  if (/decorate|flower|rangoli/.test(s)) return 'flower'
  if (/puja|aarti|priest|havan/.test(s)) return 'sparkle'
  if (/sound|light|mic/.test(s)) return 'settings'
  if (/set up|chairs|mats/.test(s)) return 'grid'
  return 'check-circle'
}

export default function PlanWithAiPanel({ idea, onClose, onConfirmed }: { idea?: string; onClose: () => void; onConfirmed: () => void }) {
  const toast = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [said, setSaid] = useState<string[]>([])
  const [asked, setAsked] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [view, setView] = useState<'chat' | 'draft' | 'last_time'>('chat')
  const [wide, setWide] = useState(false)
  const [people, setPeople] = useState<User[]>([])
  const [error, setError] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    usersApi.list().then((r) => setPeople(r.users.filter((u) => u.is_active && u.approval_status === 'approved' && u.role !== 'chairman'))).catch(() => {})
  }, [])
  // Opened from a festival reminder: start with that idea
  const started = useRef(false)
  useEffect(() => {
    if (idea && !started.current) { started.current = true; send(idea) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea])
  // Braces matter: scrollIntoView returns a promise in newer browsers.
  useEffect(() => { if (view === 'chat') end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy, view])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const next = [...said, text.trim()]
    setInput('')
    setSaid(next)
    setMessages((m) => [...m, { from: 'me', text: text.trim() }])
    setBusy(true)
    try {
      const r = await plansApi.draft(next, asked)
      if (r.ask) setAsked((a) => [...a, r.ask!])
      if (!r.draft) { setMessages((m) => [...m, { from: 'ai', text: r.reply }]); return }
      const d = r.draft
      const have = new Set((plan?.tasks ?? []).map((t) => t.title.toLowerCase()))
      const fresh = (d.tasks as SuggestedTask[]).filter((t) => !have.has(t.title.toLowerCase()))
      // Keep what's already in the plan; offer the rest as tick-box cards
      setPlan({ event: d.event, notes: d.notes, based_on: d.based_on, tasks: plan?.tasks ?? [], lastTimeTasks: d.based_on ? d.tasks : [] })
      const order: Section[] = ['space', 'event', 'crowd']
      const suggestions: Suggestion[] = d.based_on ? [] : order
        .map((section) => ({ section, tasks: fresh.filter((t) => (t.section ?? 'event') === section).map((t) => ({ ...t, picked: true })), state: 'open' as const, changingWho: false }))
        .filter((s) => s.tasks.length)
      setMessages((m) => [...m, { from: 'ai', text: r.reply, notes: d.notes, suggestions, lastTime: !!d.based_on }])
    } catch (err) {
      setMessages((m) => [...m, { from: 'ai', text: `Sorry, that didn't work: ${(err as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  const updateSuggestion = (mi: number, si: number, patch: (s: Suggestion) => Suggestion) =>
    setMessages((ms) => ms.map((m, i) => (i === mi && m.suggestions ? { ...m, suggestions: m.suggestions.map((s, j) => (j === si ? patch(s) : s)) } : m)))

  const addToPlan = (mi: number, si: number) => {
    const s = messages[mi].suggestions![si]
    const picked = s.tasks.filter((t) => t.picked).map(strip)
    const byTime = (a: PlanTask, b: PlanTask) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
    setPlan((p) => (p ? { ...p, tasks: [...p.tasks, ...picked].sort(byTime) } : p))
    updateSuggestion(mi, si, (x) => ({ ...x, state: 'added', changingWho: false }))
    toast(`Added ${picked.length} to the plan`)
  }

  const useLastTime = (thenReview: boolean) => {
    if (!plan) return
    const have = new Set(plan.tasks.map((t) => t.title.toLowerCase()))
    const all = [...plan.tasks, ...plan.lastTimeTasks.map((t) => strip(t as SuggestedTask)).filter((t) => !have.has(t.title.toLowerCase()))]
    setPlan({ ...plan, tasks: all })
    if (thenReview) setView('draft')
    return all
  }

  const startOver = () => { setMessages([]); setSaid([]); setAsked([]); setPlan(null); setView('chat'); setError('') }

  const confirm = async (tasks?: PlanTask[]) => {
    if (!plan) return
    setError('')
    setBusy(true)
    try {
      const r = await plansApi.confirm(plan.event, tasks ?? plan.tasks)
      toast(r.message)
      onConfirmed()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const who = (t: PlanTask) => (t.assigned_group ? TASK_GROUP_LABELS[t.assigned_group] : t.assigned_to_name ?? people.find((p) => p.id === t.assigned_to)?.full_name ?? 'Someone')
  const headIcons = (
    <div className="plan-head-icons">
      {view === 'chat' && messages.length > 0 && <button className="icon-btn" onClick={startOver} aria-label="New plan" title="New plan"><Icon name="edit" size={18} /></button>}
      <button className="icon-btn" onClick={() => setWide((w) => !w)} aria-label={wide ? 'Make smaller' : 'Make bigger'} title={wide ? 'Make smaller' : 'Make bigger'}><Icon name="expand" size={18} /></button>
      <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
    </div>
  )
  const icon = <span className="tile-ic ic-saf plan-ic"><span className="star">✦</span></span>
  const modalProps = { size: 'drawer' as const, onClose, hideClose: true, className: `plan-panel ${wide ? 'plan-wide' : ''}` }

  // ---------------------------------------------------------------- 09 plan from last time
  if (view === 'last_time' && plan?.based_on) {
    const b = plan.based_on
    const tasks = plan.lastTimeTasks as SuggestedTask[]
    return (
      <Modal key="last_time" title="Plan based on last time" {...modalProps}
        head={<div className="plan-head">{icon}<div className="grow"><h2>{plan.event.title} plan, based on last time</h2></div>{headIcons}</div>}
        footer={
          <div className="plan-foot">
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => confirm(useLastTime(false))}><span className="star">✦</span> {busy ? 'Adding…' : 'Add all to calendar and tasks'}</button>
            <button className="btn btn-outline btn-lg" onClick={() => useLastTime(true)}>Review tasks individually</button>
          </div>
        }
      >
        <p className="plan-intro">Plan with AI looked at <b>{b.title}</b> ({dayLabel(b.starts_at)}, {b.tasks} tasks) and drafted this one with the same jobs, moved to {dayLabel(plan.event.starts_at)} in {plan.event.resource_name}.</p>
        <div className="dsec-head"><span className="ulabel">Draft plan &amp; changes ({tasks.length} jobs)</span>{plan.event.guests ? <span className="pill pill-saf no-caps">{plan.event.guests} people expected</span> : null}</div>
        <div className="stack" style={{ gap: 12 }}>
          {tasks.map((t, i) => (
            <div key={i} className={`ly-card ${t.added || t.change ? 'changed' : ''}`}>
              <div className="ly-top">
                <b>{i + 1}. {t.title}</b>
                <span className={`tag ${t.added ? 'tag-saf' : t.change ? 'tag-upd' : 'tag-soft'}`}>{t.added ? 'New' : t.change ? 'Updated' : 'Same as last time'}</span>
              </div>
              <span className="plan-meta">{who(t)} · {dayLabel(t.due_at)}, {hhmm(t.due_at)}</span>
              {t.added && <div className="plan-note idea"><span className="star">✦</span><span>Added because about {plan.event.guests} people are expected</span></div>}
              {t.change && <div className="plan-note idea"><span className="star">✦</span><span>{t.change}</span></div>}
            </div>
          ))}
        </div>
        <ErrorNote>{error}</ErrorNote>
      </Modal>
    )
  }

  // ---------------------------------------------------------------- 08 draft plan
  if (view === 'draft' && plan) {
    return (
      <Modal key="draft" title="Draft plan" {...modalProps}
        head={
          <div className="plan-head">
            {icon}
            <div className="grow">
              <h2>{plan.event.title} · {dayLabel(plan.event.starts_at)}</h2>
              <span className="pill pill-saf">Draft</span>
              <p className="modal-sub">Draft plan made with Plan with AI. Review before confirming.</p>
            </div>
            {headIcons}
          </div>
        }
        footer={
          <div className="plan-foot">
            <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
              <button className="btn btn-primary btn-lg grow plan-confirm" disabled={busy || !plan.tasks.every((t) => t.title.trim())} onClick={() => confirm()}>
                <span className="star">✦</span> {busy ? 'Adding…' : 'Confirm plan'}
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => setView('chat')}><Icon name="message" size={17} /> Back to chat</button>
            </div>
            <span className="ai-note">Confirming adds the event to the Calendar, creates the tasks and tells the people assigned.</span>
          </div>
        }
      >
        <DraftView plan={plan} people={people} onChange={setPlan} />
        <ErrorNote>{error}</ErrorNote>
      </Modal>
    )
  }

  // ---------------------------------------------------------------- 07 chat
  return (
    <Modal key="chat" title="Plan with AI" {...modalProps}
      head={
        <div className="plan-head">
          {icon}
          <div className="grow">
            <h2>Plan with AI</h2>
            <p className="modal-sub">Try an idea. Nothing happens until you confirm.</p>
          </div>
          {headIcons}
        </div>
      }
      footer={
        <form className="plan-input" onSubmit={(e: FormEvent) => { e.preventDefault(); send(input) }}>
          {plan && (
            <button type="button" className="plan-bar" onClick={() => setView('draft')}>
              <span className="star">✦</span> Draft plan: <b>1 event, {plan.tasks.length} task{plan.tasks.length === 1 ? '' : 's'}</b>
              <span className="view">View <Icon name="arrow-right" size={14} /></span>
            </button>
          )}
          <div className="plan-ask">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={messages.length ? 'Ask or change anything…' : 'What are you planning?'} aria-label="Describe the event" autoFocus />
            <button className="plan-send" disabled={!input.trim() || busy} aria-label="Send"><Icon name="arrow-right" size={18} /></button>
          </div>
          <span className="ai-note">Plan with AI checks your halls, bookings and Temple Rules. Check important details.</span>
        </form>
      }
    >
      <div className="plan-chat">
        {!messages.length && (
          <div className="ai-empty">
            <span className="tile-ic ic-saf" style={{ width: 56, height: 56 }}><span className="star" style={{ fontSize: 26 }}>✦</span></span>
            <b>What are you planning?</b>
            <span className="muted">Say what it is, roughly how many people, and the day. I'll check the space and suggest the jobs.</span>
            <div className="chips" style={{ justifyContent: 'center', marginTop: 8 }}>
              {IDEAS.map((q) => <button key={q} type="button" className="chip" onClick={() => send(q)} disabled={busy}>{q}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, mi) => m.from === 'me' ? (
          <div key={mi} className="plan-me">{m.text}</div>
        ) : (
          <div key={mi} className="ai-msg">
            <span className="tile-ic ic-saf ai-av"><span className="star">✦</span></span>
            <div className="grow plan-bubble">
              <p>{m.text}</p>
              {m.notes?.filter((n) => n.tone === 'warn').map((n, j) => <p key={j} className="plan-rule">{n.text}</p>)}
              {m.notes?.some((n) => n.tone === 'idea') && (
                <div className="plan-ideas">
                  <span className="ai-chip"><span className="star">✦</span> Suggestions, not from your records</span>
                  <ul>{m.notes.filter((n) => n.tone === 'idea').map((n, j) => <li key={j}>{n.text}</li>)}</ul>
                </div>
              )}
              {m.suggestions?.map((s, si) => (
                <SuggestionCard key={si} s={s} plan={plan} people={people} who={who}
                  onToggle={(ti) => updateSuggestion(mi, si, (x) => ({ ...x, tasks: x.tasks.map((t, k) => (k === ti ? { ...t, picked: !t.picked } : t)) }))}
                  onWho={(ti, patch) => updateSuggestion(mi, si, (x) => ({ ...x, tasks: x.tasks.map((t, k) => (k === ti ? { ...t, ...patch } : t)) }))}
                  onChangeWho={() => updateSuggestion(mi, si, (x) => ({ ...x, changingWho: !x.changingWho }))}
                  onAdd={() => addToPlan(mi, si)}
                  onSkip={() => updateSuggestion(mi, si, (x) => ({ ...x, state: 'skipped' }))}
                />
              ))}
              {m.lastTime && plan?.based_on && mi === messages.length - 1 && (
                <div className="suggest-card">
                  <b className="suggest-q">Want to start from last time's plan?</b>
                  <span className="muted small">{plan.based_on.title} had {plan.based_on.tasks} tasks. I've moved them to the new date.</span>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-saf btn-sm" onClick={() => setView('last_time')}>See last time's plan</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="ai-msg"><span className="tile-ic ic-saf ai-av"><span className="star">✦</span></span><p className="muted">Checking the halls and the calendar…</p></div>}
        <div ref={end} />
      </div>
    </Modal>
  )
}

// 07 "Want me to set these up?": a tick list, "Add N to plan", "Change who"
function SuggestionCard({ s, plan, people, who, onToggle, onWho, onChangeWho, onAdd, onSkip }: {
  s: Suggestion
  plan: Plan | null
  people: User[]
  who: (t: PlanTask) => string
  onToggle: (i: number) => void
  onWho: (i: number, patch: Partial<PlanTask>) => void
  onChangeWho: () => void
  onAdd: () => void
  onSkip: () => void
}) {
  const place = plan?.event.resource_name ?? 'the space'
  const q = s.section === 'space' ? `Get ${place} ready and locked up after?`
    : s.section === 'crowd' ? `Set these up for the crowd?`
    : 'Add the jobs for the event itself?'
  const picked = s.tasks.filter((t) => t.picked).length
  if (s.state !== 'open') {
    return <p className="suggest-done"><Icon name={s.state === 'added' ? 'check' : 'x'} size={14} /> {s.state === 'added' ? `Added ${picked} to the plan` : 'Skipped'}: {q.replace(/\?$/, '').toLowerCase()}</p>
  }
  return (
    <div className="suggest-card">
      <b className="suggest-q">{q}</b>
      <div className="suggest-list">
        {s.tasks.map((t, i) => (
          <div key={i} className="suggest-row">
            <label className="pcheck">
              <input type="checkbox" checked={!!t.picked} onChange={() => onToggle(i)} />
              <span className="box" aria-hidden="true"><Icon name="check" size={14} /></span>
              <span>{t.title}{!s.changingWho && <>: <b>{who(t)}</b></>}</span>
            </label>
            {s.changingWho && <WhoSelect task={t} people={people} onChange={(patch) => onWho(i, patch)} />}
          </div>
        ))}
      </div>
      <div className="suggest-acts">
        <button className="btn btn-saf btn-sm" disabled={!picked} onClick={onAdd}>Add {picked} to plan</button>
        <button className="btn btn-outline btn-sm" onClick={onChangeWho}>{s.changingWho ? 'Done' : 'Change who'}</button>
        <button className="link-btn muted" onClick={onSkip}>Not now</button>
      </div>
    </div>
  )
}

function WhoSelect({ task, people, onChange }: { task: PlanTask; people: User[]; onChange: (patch: Partial<PlanTask>) => void }) {
  return (
    <select className="who-select" value={whoKey(task)} aria-label={`Who does "${task.title}"`} onChange={(ev) => {
      const [type, v] = ev.target.value.split(':')
      onChange(type === 'group' ? { assigned_group: v as TaskGroup, assigned_to: null, assigned_to_name: null } : { assigned_to: Number(v), assigned_group: null, assigned_to_name: people.find((p) => p.id === Number(v))?.full_name ?? null })
    }}>
      <optgroup label="A whole group">
        {(Object.keys(TASK_GROUP_LABELS) as TaskGroup[]).map((g) => <option key={g} value={`group:${g}`}>{TASK_GROUP_LABELS[g]}</option>)}
      </optgroup>
      <optgroup label="One person">
        {people.map((p) => <option key={p.id} value={`user:${p.id}`}>{p.full_name}</option>)}
      </optgroup>
    </select>
  )
}

// 08 draft plan: the calendar event and its tasks, each one editable.
function DraftView({ plan, people, onChange }: { plan: Plan; people: User[]; onChange: (p: Plan) => void }) {
  const [resources, setResources] = useState<Resource[]>([])
  const [editingEvent, setEditingEvent] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  useEffect(() => { resourcesApi.list().then((r) => setResources(r.resources)).catch(() => {}) }, [])

  const e = plan.event
  const setEvent = (patch: Partial<PlanEvent>) => onChange({ ...plan, event: { ...e, ...patch } })
  const setTask = (i: number, patch: Partial<PlanTask>) => onChange({ ...plan, tasks: plan.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const removeTask = (i: number) => { onChange({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) }); setEditing(null) }
  const addTask = () => {
    onChange({ ...plan, tasks: [...plan.tasks, { title: '', assigned_to: null, assigned_group: 'volunteer', due_at: e.starts_at, category: 'Events & bookings', requires_verification: false }] })
    setEditing(plan.tasks.length)
  }
  const who = (t: PlanTask) => (t.assigned_group ? TASK_GROUP_LABELS[t.assigned_group] : t.assigned_to_name ?? people.find((p) => p.id === t.assigned_to)?.full_name ?? 'Someone')
  const place = resources.find((r) => r.id === e.resource_id)
  const capacity = place?.capacity ?? e.resource_capacity
  const tooBig = !!(e.guests && capacity && e.guests > capacity)

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="dsec">
        <span className="ulabel">Calendar event</span>
        <div className="plan-card">
          <span className="tile-ic ic-ind plan-tile"><Icon name="calendar" size={20} /></span>
          {editingEvent ? (
            <div className="grow stack filled" style={{ gap: 10 }}>
              <label className="field"><span className="ulabel">Name</span><input value={e.title} onChange={(ev) => setEvent({ title: ev.target.value })} /></label>
              <div className="grid-2f">
                <label className="field"><span className="ulabel">Day</span>
                  <input type="date" value={toDateInput(new Date(e.starts_at))} onChange={(ev) => {
                    if (!ev.target.value) return
                    setEvent({ starts_at: join(ev.target.value, toTimeInput(new Date(e.starts_at))), ends_at: join(ev.target.value, toTimeInput(new Date(e.ends_at))) })
                  }} />
                </label>
                <label className="field"><span className="ulabel">Space</span>
                  <select value={e.resource_id} onChange={(ev) => { const r = resources.find((x) => x.id === Number(ev.target.value)); if (r) setEvent({ resource_id: r.id, resource_name: r.name, resource_capacity: r.capacity }) }}>
                    {resources.map((r) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (holds ${r.capacity})` : ''}</option>)}
                  </select>
                </label>
              </div>
              <div className="cols-3">
                <label className="field"><span className="ulabel">Starts</span><input type="time" value={toTimeInput(new Date(e.starts_at))} onChange={(ev) => ev.target.value && setEvent({ starts_at: join(toDateInput(new Date(e.starts_at)), ev.target.value) })} /></label>
                <label className="field"><span className="ulabel">Ends</span><input type="time" value={toTimeInput(new Date(e.ends_at))} onChange={(ev) => ev.target.value && setEvent({ ends_at: join(toDateInput(new Date(e.starts_at)), ev.target.value) })} /></label>
                <label className="field"><span className="ulabel">People</span><input type="number" min={0} value={e.guests ?? ''} onChange={(ev) => setEvent({ guests: ev.target.value === '' ? null : Number(ev.target.value) })} /></label>
              </div>
              <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEditingEvent(false)}><Icon name="check" size={14} /> Done</button>
            </div>
          ) : (
            <div className="grow">
              <div className="plan-title">{e.title} <span className="tag tag-soft">Temple event</span></div>
              <div className="plan-meta">
                {dayLabel(e.starts_at)} · {hhmm(e.starts_at)} – {hhmm(e.ends_at)} · <span className="place">{e.resource_name}</span>
                {e.guests ? <> · {e.guests} people</> : null}
              </div>
              {tooBig
                ? <p className="plan-warn">{e.resource_name} holds {capacity}, so {e.guests} won't fit.</p>
                : <p className="muted small" style={{ margin: '6px 0 0' }}>{capacity ? `Holds ${capacity}` : `No capacity on record for ${e.resource_name}`}</p>}
            </div>
          )}
          {!editingEvent && <button className="icon-btn" aria-label="Edit the event" onClick={() => setEditingEvent(true)}><Icon name="edit" size={18} /></button>}
        </div>
      </section>

      <section className="dsec">
        <div className="dsec-head"><span className="ulabel">Tasks ({plan.tasks.length})</span><button className="link-btn saf" onClick={addTask}><Icon name="plus" size={14} /> Add task</button></div>
        {plan.tasks.length === 0 && <p className="muted small" style={{ margin: 0 }}>No tasks yet. Add the ones Plan with AI suggested in the chat, or add your own.</p>}
        {plan.tasks.map((t, i) => (
          <div key={i} className="plan-card">
            <span className={`tile-ic plan-tile ${t.requires_verification ? 'ic-red' : 'ic-soft'}`}><Icon name={taskIcon(t)} size={18} /></span>
            {editing === i ? (
              <div className="grow stack filled" style={{ gap: 10 }}>
                <label className="field"><span className="ulabel">Task</span><input value={t.title} onChange={(ev) => setTask(i, { title: ev.target.value })} placeholder="What needs doing" autoFocus /></label>
                <label className="field"><span className="ulabel">Who</span><WhoSelect task={t} people={people} onChange={(patch) => setTask(i, patch)} /></label>
                <div className="grid-2f">
                  <label className="field"><span className="ulabel">Day</span><input type="date" value={toDateInput(new Date(t.due_at))} onChange={(ev) => ev.target.value && setTask(i, { due_at: join(ev.target.value, toTimeInput(new Date(t.due_at))) })} /></label>
                  <label className="field"><span className="ulabel">By</span><input type="time" value={toTimeInput(new Date(t.due_at))} onChange={(ev) => ev.target.value && setTask(i, { due_at: join(toDateInput(new Date(t.due_at)), ev.target.value) })} /></label>
                </div>
                <label className="pcheck" style={{ alignSelf: 'flex-start' }}>
                  <input type="checkbox" checked={t.requires_verification} onChange={(ev) => setTask(i, { requires_verification: ev.target.checked })} />
                  <span className="box" aria-hidden="true"><Icon name="check" size={14} /></span>
                  <span>Safety task (someone checks it after)</span>
                </label>
                <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!t.title.trim()} onClick={() => setEditing(null)}><Icon name="check" size={14} /> Done</button>
              </div>
            ) : (
              <div className="grow">
                <div className="plan-title">{t.title || <span className="muted">Untitled task</span>}</div>
                <div className="plan-meta">Assigned: <b>{who(t)}</b> · {dayLabel(t.due_at)}, {hhmm(t.due_at)}</div>
              </div>
            )}
            {editing !== i && (
              <div className="plan-acts">
                <button className="icon-btn" aria-label={`Edit "${t.title}"`} onClick={() => setEditing(i)}><Icon name="edit" size={17} /></button>
                <button className="icon-btn" aria-label={`Remove "${t.title}"`} onClick={() => removeTask(i)}><Icon name="trash" size={17} /></button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
