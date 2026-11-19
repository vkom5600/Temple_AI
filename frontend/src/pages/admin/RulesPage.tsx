import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { rulesApi } from '../../api/endpoints'
import { fmtDay } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Modal, Spinner } from '../../components/ui'
import type { TempleRule } from '../../types'
import { useAccess } from '../../lib/access'
import ViewOnly from '../../components/ViewOnly'

// AC4 Temple Rules (design: screens/15_AC4): "Temple AI checks every request against
// these. It recommends – you decide." Rules marked "Ask the person booking" make up the
// checklist on the booking form (M7), which they must tick before they can send.
const CATEGORIES = ['Bookings & halls', 'Stalls & vendors', 'Kitchen & spaces']
type Draft = Pick<TempleRule, 'text' | 'category' | 'ask_requester' | 'is_active' | 'sort_order'> & { id?: number }

export default function RulesPage() {
  const manage = useAccess().can('rules', 'manage')
  const toast = useToast()
  const [rules, setRules] = useState<TempleRule[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [showOff, setShowOff] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(() => {
    rulesApi.list(true).then((r) => setRules(r.rules)).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const active = (rules ?? []).filter((r) => r.is_active)
  const off = (rules ?? []).filter((r) => !r.is_active)
  const categories = [...new Set([...CATEGORIES, ...active.map((r) => r.category)])].filter((c) => active.some((r) => r.category === c))
  const last = [...(rules ?? [])].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
  let n = 0

  return (
    <div className="page">
      <Link to="/admin/action-center" className="link-arrow" style={{ color: 'var(--ink-2)', fontWeight: 500 }}><Icon name="arrow-left" size={15} /> Action Center</Link>
      <header className="page-head">
        <div>
          <h1>Temple Rules {!manage && <ViewOnly />}</h1>
          <p>Temple AI checks every request against these. It recommends – you decide.</p>
        </div>
        <div className="head-actions">
          {manage && <button className="btn btn-outline" onClick={() => setUploading(true)}><Icon name="upload" size={16} /> Upload rules document</button>}
          {manage && <button className="btn btn-saf" style={{ color: '#fff', background: '#f7a033' }} onClick={() => setEditing({ text: '', category: CATEGORIES[0], ask_requester: false, is_active: true, sort_order: 100 })}>
            <Icon name="plus" size={16} /> Add rule
          </button>}
        </div>
      </header>

      <ErrorNote>{error}</ErrorNote>
      {!rules && !error && <Spinner />}

      {rules && (
        <section className="panel rules-page">
          {categories.map((cat) => {
            const list = active.filter((r) => r.category === cat)
            return (
              <div key={cat} className="rule-group">
                <div className="rule-group-head"><span>{cat}</span><span>{list.length} rule{list.length === 1 ? '' : 's'}</span></div>
                {list.map((r) => (
                  <button key={r.id} className="rule-row" disabled={!manage} onClick={() => setEditing(r)}>
                    <span className="rule-n">{++n}.</span>
                    <span className="grow">{r.text}</span>
                    {r.ask_requester && <span className="tag tag-ind" title="On the booking form checklist">Asked when booking</span>}
                  </button>
                ))}
              </div>
            )
          })}
          <div className="rule-foot">
            <span>{last ? `Last updated${last.updated_by_name ? ` by ${last.updated_by_name}` : ''} · ${fmtDay(last.updated_at)}` : ''}</span>
            <span className="row" style={{ gap: 6, color: 'var(--green)' }}><Icon name="shield" size={15} /> Temple AI checks requests against all {active.length} rules</span>
          </div>
        </section>
      )}

      {off.length > 0 && (
        <div>
          <button className="done-toggle" onClick={() => setShowOff((v) => !v)} aria-expanded={showOff}>Switched off ({off.length}) <Icon name="chevron-down" size={16} /></button>
          {showOff && (
            <section className="panel rules-page" style={{ marginTop: 10 }}>
              {off.map((r) => (
                <button key={r.id} className="rule-row off" disabled={!manage} onClick={() => setEditing(r)}><span className="grow">{r.text}</span><span className="muted small">{r.category}</span></button>
              ))}
            </section>
          )}
        </div>
      )}

      <div className="how-box">
        <Icon name="alert" size={18} />
        <span><b>How it works:</b> when someone asks for a hall, room or stall, the request is checked against these rules (capacity, finishing time, clashes, and that they ticked every "asked when booking" rule). The chairman or any committee member decides.</span>
      </div>

      {uploading && <UploadRules existing={active.map((r) => r.text)} onClose={() => setUploading(false)} onDone={(m) => { toast(m); setUploading(false); load() }} />}
      {editing && <RuleDialog draft={editing} onClose={() => setEditing(null)} onSaved={(m) => { toast(m); setEditing(null); load() }} />}
    </div>
  )
}

function RuleDialog({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (message: string) => void }) {
  const [d, setD] = useState(draft)
  const [newCategory, setNewCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (patch: Partial<Draft> = {}) => {
    setError('')
    setBusy(true)
    const body = { ...d, ...patch, category: d.category === '__new' ? newCategory.trim() : d.category }
    try {
      const r = d.id ? await rulesApi.update(d.id, body) : await rulesApi.create(body)
      onSaved(r.message)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={d.id ? 'Edit rule' : 'Add a rule'}
      onClose={onClose}
      footer={
        <>
          {d.id && (d.is_active
            ? <button className="btn-text-red push-left" disabled={busy} onClick={() => save({ is_active: false })}>Switch off</button>
            : <button className="btn btn-outline push-left" disabled={busy} onClick={() => save({ is_active: true })}>Switch back on</button>)}
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!d.text.trim() || (d.category === '__new' && !newCategory.trim()) || busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <label className="field"><span className="label">The rule</span>
        <textarea rows={3} autoFocus maxLength={300} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="e.g. Bookings must end by 21:00 on weekdays and 22:00 at weekends." />
      </label>
      <label className="field"><span className="label">Group</span>
        <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
          {[...new Set([...CATEGORIES, draft.category])].map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__new">New group…</option>
        </select>
      </label>
      {d.category === '__new' && <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Group name" maxLength={40} />}
      <label className="checkline">
        <input type="checkbox" checked={d.ask_requester} onChange={(e) => setD({ ...d, ask_requester: e.target.checked })} />
        <span><b>Ask the person booking to agree</b><span>It goes on the booking form's checklist. They must tick every one before they can send.</span></span>
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}

// "Upload rules document" (AC4): a text file or pasted text becomes a list of proposed
// rules. Each is checked and given a category before anything is added.
// (PDF / Word: copy the text and paste it in.)
function splitRules(text: string) {
  return text
    .split(/\r?\n|(?<=\.)\s+(?=\d+[.)]\s)/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\(?\d{1,3}[.)]|[a-z][.)])\s+/i, '').trim())
    .filter((l) => l.length >= 8 && l.length <= 500 && !/^(temple rules|rules|terms|bookings?|stalls?|kitchen)[:\s]*$/i.test(l))
}
const guessCategory = (t: string) => (/stall|vendor|food stall|hygiene/i.test(t) ? CATEGORIES[1] : /kitchen|cook|gas|mandir|shrine/i.test(t) ? CATEGORIES[2] : CATEGORIES[0])

function UploadRules({ existing, onClose, onDone }: { existing: string[]; onClose: () => void; onDone: (message: string) => void }) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<{ text: string; category: string; keep: boolean; ask: boolean }[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const known = new Set(existing.map((t) => t.toLowerCase().replace(/\W+/g, ' ').trim()))

  const readFile = async (file: File) => {
    setError('')
    if (/\.(pdf|docx?|pages)$/i.test(file.name)) { setError("PDF and Word files can't be read here yet. Open the document, copy the rules and paste them below."); return }
    if (file.size > 200_000) { setError('That file is too big. Paste the rules instead.'); return }
    setText(await file.text())
  }
  const review = () => {
    const found = splitRules(text)
    if (!found.length) { setError("No rules found. Put each rule on its own line."); return }
    setItems(found.map((t) => ({ text: t, category: guessCategory(t), keep: !known.has(t.toLowerCase().replace(/\W+/g, ' ').trim()), ask: false })))
  }
  const add = async () => {
    if (!items) return
    setBusy(true)
    setError('')
    let n = 0
    try {
      for (const it of items.filter((i) => i.keep)) {
        await rulesApi.create({ text: it.text, category: it.category, ask_requester: it.ask, is_active: true, sort_order: 100 })
        n++
      }
      onDone(`${n} rule${n === 1 ? '' : 's'} added`)
    } catch (err) {
      setError(`${n} added, then: ${(err as Error).message}`)
      setBusy(false)
    }
  }
  const keep = items?.filter((i) => i.keep).length ?? 0

  return (
    <Modal title="Upload rules document" size="wide" onClose={onClose}
      subtitle={items ? 'Check each rule and its section. Untick any you don\'t want.' : 'Choose a text file, or paste the rules. Each line becomes a rule you can check before adding.'}
      footer={items
        ? <><button className="btn btn-ghost" onClick={() => setItems(null)}>Back</button><button className="btn btn-primary" disabled={!keep || busy} onClick={add}>{busy ? 'Adding…' : `Add ${keep} rule${keep === 1 ? '' : 's'}`}</button></>
        : <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!text.trim()} onClick={review}>Read the rules</button></>}>
      {!items ? (
        <div className="stack filled" style={{ gap: 12 }}>
          <label className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
            <Icon name="upload" size={16} /> Choose a file (.txt)
            <input type="file" accept=".txt,.md,text/plain" hidden onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1. Community Hall holds max 120 people.\n2. Bookings must end by 21:00 on weekdays.\n...'} aria-label="Rules text" />
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {items.map((it, i) => (
            <div key={i} className={`upload-rule ${it.keep ? '' : 'skip'}`}>
              <label className="pcheck"><input type="checkbox" checked={it.keep} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} /><span className="box" aria-hidden="true"><Icon name="check" size={14} /></span><span>{it.text}</span></label>
              <div className="row" style={{ gap: 8, marginLeft: 32 }}>
                <select value={it.category} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} aria-label="Section">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <label className="pcheck small-check"><input type="checkbox" checked={it.ask} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, ask: e.target.checked } : x)))} /><span className="box" aria-hidden="true"><Icon name="check" size={12} /></span><span className="muted small">Ask when booking</span></label>
                {!it.keep && known.has(it.text.toLowerCase().replace(/\W+/g, ' ').trim()) && <span className="tag tag-soft">Already a rule</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
