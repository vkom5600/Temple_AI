import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { rulesApi } from '../../api/endpoints'
import { fmtDay } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { ErrorNote, Icon, Modal, Spinner } from '../../components/ui'
import type { TempleRule } from '../../types'

// AC4 Temple Rules (design: screens/15_AC4): "Temple AI checks every request against
// these. It recommends – you decide." Rules marked "Ask the person booking" make up the
// checklist on the booking form (M7), which they must tick before they can send.
const CATEGORIES = ['Bookings & halls', 'Stalls & vendors', 'Kitchen & spaces']
type Draft = Pick<TempleRule, 'text' | 'category' | 'ask_requester' | 'is_active' | 'sort_order'> & { id?: number }

export default function RulesPage() {
  const toast = useToast()
  const [rules, setRules] = useState<TempleRule[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [showOff, setShowOff] = useState(false)

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
          <h1>Temple Rules</h1>
          <p>Temple AI checks every request against these. It recommends – you decide.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-saf" style={{ color: '#fff', background: '#f7a033' }} onClick={() => setEditing({ text: '', category: CATEGORIES[0], ask_requester: false, is_active: true, sort_order: 100 })}>
            <Icon name="plus" size={16} /> Add rule
          </button>
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
                  <button key={r.id} className="rule-row" onClick={() => setEditing(r)}>
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
            <span className="row" style={{ gap: 6, color: 'var(--green)' }}><Icon name="shield" size={15} /> Requests are checked against all {active.length} rules</span>
          </div>
        </section>
      )}

      {off.length > 0 && (
        <div>
          <button className="done-toggle" onClick={() => setShowOff((v) => !v)} aria-expanded={showOff}>Switched off ({off.length}) <Icon name="chevron-down" size={16} /></button>
          {showOff && (
            <section className="panel rules-page" style={{ marginTop: 10 }}>
              {off.map((r) => (
                <button key={r.id} className="rule-row off" onClick={() => setEditing(r)}><span className="grow">{r.text}</span><span className="muted small">{r.category}</span></button>
              ))}
            </section>
          )}
        </div>
      )}

      <div className="how-box">
        <Icon name="alert" size={18} />
        <span><b>How it works:</b> when someone asks for a hall, room or stall, the request is checked against these rules (capacity, finishing time, clashes, and that they ticked every "asked when booking" rule). The chairman or any committee member decides.</span>
      </div>

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
