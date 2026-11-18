import { useEffect, useState } from 'react'
import { resourcesApi } from '../../api/endpoints'
import { useToast } from '../Toast'
import { ErrorNote, Icon, Modal, Spinner } from '../ui'
import type { Resource, ResourceKind } from '../../types'

// Halls & rooms (chairman): the spaces that can be booked and appear in the Allocation view.
// The committee said there are 10 in all; rename, add or switch them off here.
const KINDS: { id: ResourceKind; label: string }[] = [
  { id: 'hall', label: 'Hall' },
  { id: 'room', label: 'Room' },
  { id: 'mandir', label: 'Mandir' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'space', label: 'Other space' },
]
type Row = Pick<Resource, 'name' | 'kind' | 'capacity' | 'notes' | 'is_active' | 'sort_order'> & { id?: number }

export default function ResourcesDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => { resourcesApi.list(true).then((r) => setRows(r.resources)).catch((e: Error) => setError(e.message)) }
  useEffect(load, [])

  const save = async () => {
    if (!editing) return
    setError('')
    setBusy(true)
    try {
      const r = editing.id ? await resourcesApi.update(editing.id, editing) : await resourcesApi.create(editing)
      toast(r.message)
      setEditing(null)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Halls & rooms"
      subtitle={`${rows?.filter((r) => r.is_active).length ?? '…'} spaces can be booked. The committee listed 10.`}
      size="wide"
      onClose={onClose}
      footer={editing ? (
        <>
          <button className="btn btn-outline" onClick={() => setEditing(null)}>Back</button>
          <button className="btn btn-primary" disabled={!editing.name.trim() || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      ) : (
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', kind: 'room', capacity: null, notes: '', is_active: true, sort_order: (rows?.length ?? 0) * 10 + 10 })}>
          <Icon name="plus" size={16} /> Add a space
        </button>
      )}
    >
      {!rows && !error && <Spinner />}
      {!editing && rows && (
        <div className="list-card">
          {rows.map((r) => (
            <button key={r.id} className="mini-task" onClick={() => setEditing(r)}>
              <span className={`dot ${r.is_active ? 'grn' : ''}`} />
              <span className="grow"><b>{r.name}</b><small style={{ color: 'var(--muted)' }}>{KINDS.find((k) => k.id === r.kind)?.label}{r.capacity ? ` · up to ${r.capacity}` : ''}{r.notes ? ` · ${r.notes}` : ''}{r.is_active ? '' : ' · switched off'}</small></span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
      )}
      {editing && (
        <div className="stack">
          <div className="grid-2f">
            <label className="field"><span className="label">Name</span><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus placeholder="e.g. Room G39" /></label>
            <label className="field"><span className="label">Type</span>
              <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as ResourceKind })}>
                {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid-2f">
            <label className="field"><span className="label">Holds up to <span className="muted">(people, optional)</span></span>
              <input type="number" min={1} value={editing.capacity ?? ''} onChange={(e) => setEditing({ ...editing, capacity: e.target.value ? Number(e.target.value) : null })} />
            </label>
            <label className="field"><span className="label">Order in lists</span>
              <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </label>
          </div>
          <label className="field"><span className="label">Note <span className="muted">(optional)</span></span>
            <input value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="e.g. Not bookable during aarti times" />
          </label>
          <label className="checkline"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            <span><b>Can be booked</b><span>Switch off to hide it from booking forms and the allocation view.</span></span>
          </label>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
