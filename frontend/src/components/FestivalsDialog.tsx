import { useEffect, useState } from 'react'
import { festivalsApi, type FestivalInput } from '../api/endpoints'
import { toDateInput } from '../lib/format'
import { useToast } from './Toast'
import { ErrorNote, Icon, Modal, Spinner } from './ui'
import type { Festival } from '../types'

// H2: the festival list behind the festival-day Home, the "Coming up" line and the
// planning reminder. The committee keeps it; dates marked "to confirm" need checking
// with the priest (the seeded examples start that way).

const BLANK: FestivalInput = { name: '', subtitle: '', date: '', kind: 'festival', opens: '', closes: '', confirmed: true, remind: true }
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export default function FestivalsDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [list, setList] = useState<Festival[] | null>(null)
  const [editing, setEditing] = useState<{ id: number | null; form: FestivalInput } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => festivalsApi.list(toDateInput(new Date(Date.now() - 31 * 86_400_000)), toDateInput(new Date(Date.now() + 730 * 86_400_000)))
    .then((r) => setList(r.festivals)).catch((e: Error) => setError(e.message))
  useEffect(() => { load() }, [])

  const set = <K extends keyof FestivalInput>(k: K, v: FestivalInput[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e))
  const save = async () => {
    if (!editing) return
    setError('')
    setBusy(true)
    try {
      const input = { ...editing.form, subtitle: editing.form.subtitle || null, opens: editing.form.opens || null, closes: editing.form.closes || null }
      const r = editing.id ? await festivalsApi.update(editing.id, input) : await festivalsApi.create(input)
      toast(r.message)
      setEditing(null)
      load()
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (f: Festival) => {
    try { toast((await festivalsApi.remove(f.id)).message); load(); onChanged() } catch (err) { setError((err as Error).message) }
  }

  if (editing) {
    const f = editing.form
    return (
      <Modal title={editing.id ? 'Edit festival' : 'Add a festival'} onClose={() => setEditing(null)}
        footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Back</button><button className="btn btn-primary" disabled={busy || !f.name.trim() || !f.date} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
        <div className="stack filled" style={{ gap: 14 }}>
          <div className="grid-2f">
            <label className="field"><span className="ulabel">Name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Diwali" autoFocus /></label>
            <label className="field"><span className="ulabel">Also called</span><input value={f.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} placeholder="Festival of Lights" /></label>
          </div>
          <div className="grid-2f">
            <label className="field"><span className="ulabel">Day</span><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label className="field"><span className="ulabel">Type</span>
              <select value={f.kind} onChange={(e) => set('kind', e.target.value as FestivalInput['kind'])}>
                <option value="festival">Festival (big day, planned)</option>
                <option value="observance">Observance (e.g. Ekadashi)</option>
              </select>
            </label>
          </div>
          <div className="grid-2f">
            <label className="field"><span className="ulabel">Mandir opens (if different)</span><input type="time" value={f.opens ?? ''} onChange={(e) => set('opens', e.target.value)} /></label>
            <label className="field"><span className="ulabel">Mandir closes</span><input type="time" value={f.closes ?? ''} onChange={(e) => set('closes', e.target.value)} /></label>
          </div>
          <label className="pcheck"><input type="checkbox" checked={f.confirmed} onChange={(e) => set('confirmed', e.target.checked)} /><span className="box" aria-hidden="true"><Icon name="check" size={14} /></span><span>The date is confirmed (checked with the priest)</span></label>
          {f.kind === 'festival' && <label className="pcheck"><input type="checkbox" checked={f.remind} onChange={(e) => set('remind', e.target.checked)} /><span className="box" aria-hidden="true"><Icon name="check" size={14} /></span><span>Remind us on Home 6 weeks before, to plan it</span></label>}
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Festivals" subtitle="Shown on Home and the Calendar. Big festivals get a planning reminder 6 weeks before." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => setEditing({ id: null, form: BLANK })}><Icon name="plus" size={16} /> Add a festival</button></>}>
      {!list && !error && <Spinner />}
      <ErrorNote>{error}</ErrorNote>
      {list && list.length === 0 && <p className="muted">No festivals yet. Add the temple's festival days for the year.</p>}
      <div className="stack" style={{ gap: 10 }}>
        {list?.map((f) => (
          <div key={f.id} className="fest-row">
            <span className="tile-ic ic-saf"><Icon name="diya" size={18} /></span>
            <div className="grow">
              <b>{f.name}</b>{f.subtitle && <span className="muted"> · {f.subtitle}</span>}
              <div className="muted small">
                {nice(f.date)}{f.kind === 'observance' ? ' · observance' : ''}{f.opens && f.closes ? ` · open ${f.opens}–${f.closes}` : ''}
                {!f.confirmed && <span className="tag tag-saf" style={{ marginLeft: 8 }}>Date to confirm</span>}
              </div>
            </div>
            <button className="icon-btn" aria-label={`Edit ${f.name}`} onClick={() => setEditing({ id: f.id, form: { name: f.name, subtitle: f.subtitle, date: f.date, kind: f.kind, opens: f.opens, closes: f.closes, confirmed: f.confirmed, remind: f.remind } })}><Icon name="edit" size={17} /></button>
            <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => remove(f)}><Icon name="trash" size={17} /></button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
