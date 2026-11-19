import { useCallback, useEffect, useState } from 'react'
import { attendanceApi } from '../../api/endpoints'
import { fmtDay, fmtTime } from '../../lib/format'
import { useToast } from '../Toast'
import { ErrorNote, Icon, Modal } from '../ui'
import type { ClosingChecks, MyAttendance } from '../../types'

// "I'm here" / "I'm leaving" / "I'm back".
// optIn: chairman and committee only see it after tapping "I'm helping today".
export default function CheckInCard({ optIn = false }: { optIn?: boolean }) {
  const toast = useToast()
  const [me, setMe] = useState<MyAttendance | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [history, setHistory] = useState(false)

  const load = useCallback(() => {
    attendanceApi.me().then(setMe).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const run = async (action: () => Promise<MyAttendance & { message: string }>) => {
    setError('')
    setBusy(true)
    try {
      const r = await action()
      setMe(r)
      toast(r.message)
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!me) return error ? <ErrorNote>{error}</ErrorNote> : null

  const today = me.today
  const present = today?.status === 'present' && today.check_in

  // Admins who haven't opted in today: just a small prompt.
  if (optIn && !today) {
    return (
      <section className="panel checkin-card checkin-optin">
        <div className="grow">
          <div className="strong">Helping on site today?</div>
          <div className="muted small">Check in so you count as on site, and you'll be asked for the closing checks if you're last to leave.</div>
        </div>
        <button className="btn btn-outline" disabled={busy} onClick={() => run(attendanceApi.checkIn)}>I'm helping today</button>
      </section>
    )
  }

  return (
    <section className={`checkin-card ${me.on_site ? 'is-here' : ''}`} aria-live="polite">
      <div className="checkin-state">
        <span className={`checkin-dot ${me.on_site ? 'on' : ''}`} aria-hidden="true" />
        <div className="grow">
          {me.on_site && <div className="strong">Here since {fmtTime(today!.check_in!)}</div>}
          {present && today!.check_out && (
            <div className="strong">Left at {fmtTime(today!.check_out)}{today!.closing_confirmed_at && ' · locked up'}</div>
          )}
          {today?.status === 'absent' && <div className="strong">Marked absent today{today.notes && ` (${today.notes})`}</div>}
          {!today && <div className="strong">Not checked in yet</div>}
          <button className="link-btn small muted" onClick={() => setHistory(true)}>My attendance</button>
        </div>

        {me.on_site ? (
          <div className="row">
            {me.can_undo && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(attendanceApi.undoCheckIn)}><Icon name="undo" size={14} /> Undo</button>}
            <button className="btn btn-outline" disabled={busy} onClick={() => { load(); setLeaving(true) }}>I'm leaving</button>
          </div>
        ) : present && today!.check_out ? (
          <button className="btn btn-outline" disabled={busy} onClick={() => run(attendanceApi.back)}>I'm back</button>
        ) : (
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(attendanceApi.checkIn)}>
            {today?.status === 'absent' ? "I'm here after all" : "I'm here"}
          </button>
        )}
      </div>
      <ErrorNote>{error}</ErrorNote>

      {leaving && (
        <LeavingSheet
          me={me}
          busy={busy}
          onClose={() => setLeaving(false)}
          onLeave={async (closing) => { if (await run(() => attendanceApi.leave(closing))) setLeaving(false) }}
        />
      )}
      {history && <HistoryDialog me={me} onClose={() => setHistory(false)} />}
    </section>
  )
}

// M8 "Leave now?". Lists tasks not done yet; the last person out also confirms
// lamps, gas and doors (skipping tells the chairman).
export function LeavingSheet({ me, busy, unfinished = [], onClose, onLeave }: {
  me: MyAttendance
  busy: boolean
  unfinished?: string[]
  onClose: () => void
  onLeave: (closing?: ClosingChecks) => void
}) {
  const [checks, setChecks] = useState<ClosingChecks>({ lamps: false, gas: false, doors: false })
  const all = Object.values(checks).every(Boolean)
  const items = Object.entries(me.closing_items) as [keyof ClosingChecks, string][]
  const last = me.last_one_here

  const warning = unfinished.length > 0 && (
    <div className="ai-banner" style={{ alignItems: 'flex-start' }}>
      <Icon name="alert" size={20} />
      <div>
        <b>{unfinished.length} task{unfinished.length > 1 ? 's' : ''} not done</b>
        <div>{unfinished.join(', ')}</div>
      </div>
    </div>
  )

  return (
    <Modal
      title={last ? "You're the last one here" : 'Leave now?'}
      size="sheet"
      onClose={onClose}
      footer={
        <div className="stack" style={{ width: '100%' }}>
          {last ? (
            <>
              <button className="btn btn-success btn-big" disabled={!all || busy} onClick={() => onLeave(checks)}><Icon name="check" /> All done, leave</button>
              <button className="btn btn-danger-ghost" disabled={busy} onClick={() => onLeave(checks)}>Leave without checking</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-big" disabled={busy} onClick={() => onLeave()}><Icon name="check" /> Yes, I'm leaving</button>
              <button className="btn btn-outline btn-big" onClick={onClose}>No, stay</button>
            </>
          )}
        </div>
      }
    >
      {warning}
      {last ? (
        <>
          <p style={{ margin: 0 }}>Before you go, please check:</p>
          <div className="stack-tight">
            {items.map(([key, label]) => (
              <label key={key} className={`closing-check ${checks[key] ? 'on' : ''}`}>
                <input type="checkbox" checked={checks[key]} onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {!all && <p className="muted small">If you leave without ticking everything, the chairman will be told.</p>}
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Others are still here, so they'll lock up.</p>
      )}
    </Modal>
  )
}

export function HistoryDialog({ me, onClose }: { me: MyAttendance; onClose: () => void }) {
  const hours = (inAt: string | null, outAt: string | null) => {
    if (!inAt || !outAt) return ''
    const mins = Math.round((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000)
    return ` · ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
  }
  return (
    <Modal title="My attendance (30 days)" onClose={onClose}>
      {me.history.length === 0 && <p className="muted">No attendance yet.</p>}
      <ul className="history-list">
        {me.history.map((h) => (
          <li key={h.attendance_date}>
            <span className="strong">{fmtDay(`${h.attendance_date.slice(0, 10)}T12:00:00`)}</span>
            <span className="muted">
              {h.status === 'absent'
                ? 'Absent'
                : `${h.check_in ? fmtTime(h.check_in) : '?'} – ${h.check_out ? fmtTime(h.check_out) : 'still in'}${hours(h.check_in, h.check_out)}`}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
