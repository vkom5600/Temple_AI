import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { attendanceApi } from '../../api/endpoints'
import { ROLE_LABELS, TASK_GROUP_LABELS, jobLabel } from '../../constants'
import { fmtTime, toDateInput, toTimeInput } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, ErrorNote, Icon, Modal, Spinner } from '../../components/ui'
import type { AttendanceDay, PresenceRow, PresenceState } from '../../types'

const STATE: Record<PresenceState, { label: string; tone: 'green' | 'neutral' | 'amber' | 'red' }> = {
  here: { label: 'Here', tone: 'green' },
  left: { label: 'Left', tone: 'neutral' },
  not_in: { label: 'Not in', tone: 'amber' },
  absent: { label: 'Absent', tone: 'red' },
}

const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

const longDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

// Chairman / committee: who came in on a day, gaps, closing checks.
// Mark someone absent or correct any record.
export default function WhosOnPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? ''
  const [day, setDay] = useState<AttendanceDay | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PresenceRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError('')
    attendanceApi.day(date || undefined).then(setDay).catch((e: Error) => setError(e.message))
  }, [date])

  useEffect(load, [load])

  const today = toDateInput(new Date())
  const shown = day?.date ?? date ?? today
  const goTo = (d: string) => setParams(d && d !== today ? { date: d } : {}, { replace: true })

  const markAbsent = async (row: PresenceRow) => {
    if (!day) return
    setBusy(true)
    try {
      toast((await attendanceApi.save(row.user_id, day.date, { status: 'absent', check_in: null, check_out: null, notes: '' })).message)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Who's on</h1>
          <p className="muted">Who checked in, who's still here, and whether the temple was locked up properly.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="row date-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => goTo(shiftDate(shown, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={shown} max={today} onChange={(e) => goTo(e.target.value)} aria-label="Day" />
          <button className="btn btn-ghost btn-sm" onClick={() => goTo(shiftDate(shown, 1))} disabled={shown >= today} aria-label="Next day">›</button>
          {shown !== today && <button className="btn btn-ghost btn-sm" onClick={() => goTo('')}>Today</button>}
        </div>
        <span className="muted">{day && longDay(day.date)}</span>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!day && !error && <Spinner />}

      {day && (
        <>
          <div className="stats">
            <div className={`stat ${day.counts.here ? 'stat-green' : ''}`}><div className="stat-value">{day.counts.here}</div><div className="stat-label">Here now</div></div>
            <div className="stat"><div className="stat-value">{day.counts.left}</div><div className="stat-label">Came and left</div></div>
            <div className={`stat ${day.counts.not_in ? 'stat-amber' : ''}`}><div className="stat-value">{day.counts.not_in}</div><div className="stat-label">Not in</div></div>
            <div className={`stat ${day.counts.absent ? 'stat-red' : ''}`}><div className="stat-value">{day.counts.absent}</div><div className="stat-label">Absent</div></div>
          </div>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head"><h2>Cover</h2></div>
              {day.gaps.length === 0 ? (
                <p className="muted small"><Icon name="check" size={14} /> Every job had someone in.</p>
              ) : (
                <div className="stack-tight">
                  {day.gaps.map((g) => (
                    <div key={g} className="whos-row whos-gap">
                      <span className="gap-mark">!</span>
                      <div className="grow">
                        <div>No {TASK_GROUP_LABELS[g].toLowerCase()} {shown === today ? 'in today' : 'in'}</div>
                        <div className="meta">{g === 'volunteer' ? 'Nobody to sign off safety tasks' : 'Their tasks may not get done'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Closing</h2></div>
              {!day.closing && <p className="muted small">{shown === today ? 'Nobody has locked up yet.' : 'Nobody recorded the closing checks.'}</p>}
              {day.closing?.confirmed && (
                <p className="small"><Badge tone="green">Locked up</Badge> {day.closing.by} confirmed lamps, gas and doors at {fmtTime(day.closing.at)}.</p>
              )}
              {day.closing && !day.closing.confirmed && (
                <p className="small">
                  <Badge tone="red">Checks skipped</Badge> {day.closing.by} left last without confirming{' '}
                  {Object.entries(day.closing.checks ?? {}).filter(([, ok]) => !ok).map(([k]) => k).join(', ')}.
                </p>
              )}
            </section>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Person</th><th>Status</th><th>In</th><th>Out</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {day.people.map((p) => (
                  <tr key={p.user_id}>
                    <td>
                      <div className="row nowrap">
                        <Avatar name={p.full_name} size={30} />
                        <div>
                          <div className="strong">{p.full_name}</div>
                          <div className="muted small">{p.designation ? jobLabel(p) : ROLE_LABELS[p.role]}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={STATE[p.state].tone}>{STATE[p.state].label}</Badge></td>
                    <td className="nowrap">{p.check_in ? fmtTime(p.check_in) : '—'}</td>
                    <td className="nowrap">{p.check_out ? fmtTime(p.check_out) : p.state === 'here' ? <span className="muted">still here</span> : '—'}</td>
                    <td className="small">
                      {p.notes}
                      {p.updated_by_name && p.id && <div className="muted">Last change: {p.updated_by_name}</div>}
                    </td>
                    <td className="nowrap right">
                      {p.state === 'not_in' && (
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => markAbsent(p)}>Mark absent</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>{p.id ? 'Edit' : 'Add'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && day && (
        <RecordEditor
          row={editing}
          date={day.date}
          onClose={() => setEditing(null)}
          onSaved={(m) => { toast(m); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function RecordEditor({ row, date, onClose, onSaved }: { row: PresenceRow; date: string; onClose: () => void; onSaved: (message: string) => void }) {
  const [status, setStatus] = useState<'present' | 'absent'>(row.status ?? 'present')
  const [inAt, setInAt] = useState(row.check_in ? toTimeInput(new Date(row.check_in)) : '09:00')
  const [outAt, setOutAt] = useState(row.check_out ? toTimeInput(new Date(row.check_out)) : '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const iso = (time: string) => (time ? new Date(`${date}T${time}`).toISOString() : null)

  const run = async (action: () => Promise<{ message: string }>) => {
    setError('')
    setBusy(true)
    try {
      onSaved((await action()).message)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`${row.id ? 'Correct' : 'Add'} ${row.full_name}'s attendance`}
      onClose={onClose}
      footer={
        <>
          {row.id && (
            <button className="btn btn-danger-ghost push-left" disabled={busy} onClick={() => run(() => attendanceApi.remove(row.user_id, date))}>Remove record</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || (status === 'present' && !inAt)}
            onClick={() => run(() => attendanceApi.save(row.user_id, date, { status, check_in: status === 'present' ? iso(inAt) : null, check_out: status === 'present' ? iso(outAt) : null, notes }))}
          >
            Save
          </button>
        </>
      }
    >
      <p className="muted small">{longDay(date)}. {row.full_name} will get a notification about the change.</p>
      <div className="seg">
        <button className={status === 'present' ? 'on' : ''} aria-pressed={status === 'present'} onClick={() => setStatus('present')}>Came in</button>
        <button className={status === 'absent' ? 'on' : ''} aria-pressed={status === 'absent'} onClick={() => setStatus('absent')}>Absent</button>
      </div>
      {status === 'present' && (
        <div className="form-grid">
          <label className="field"><span className="label">Came in</span><input type="time" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
          <label className="field"><span className="label">Left <span className="muted">(blank = still here)</span></span><input type="time" value={outAt} onChange={(e) => setOutAt(e.target.value)} /></label>
        </div>
      )}
      <label className="field">
        <span className="label">Notes <span className="muted">(optional)</span></span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={status === 'absent' ? 'e.g. Unwell' : 'e.g. Forgot to check out'} />
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
