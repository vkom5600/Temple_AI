import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { fmtTime, timeAgo } from '../../lib/format'
import { useToast } from '../Toast'
import { Badge, Empty, ErrorNote, Icon, Spinner } from '../ui'
import type { Task } from '../../types'

// Second-person sign-off for safety tasks. Used by volunteers (Sign-offs tab)
// and by the chairman / committee (Sign-offs page). You can't sign off your own.
export default function VerifyList({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    tasksApi.signoffs().then((r) => setTasks(r.tasks)).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const act = async (id: number, action: () => Promise<{ message: string }>) => {
    setError('')
    setBusyId(id)
    try {
      const r = await action()
      toast(r.message)
      setRejecting(null)
      setNote('')
      load()
      onChanged?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  if (!tasks) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />
  if (!tasks.length) return <Empty icon="shield">Nothing waiting for sign-off.</Empty>

  return (
    <div className="stack">
      <ErrorNote>{error}</ErrorNote>
      {tasks.map((t) => (
        <div key={t.id} className="card verify">
          <div className="verify-main">
            <div className="task-title">{t.title}</div>
            <div className="meta">
              {t.area && `${t.area} · `}done by <b>{t.completed_by_name}</b> at {fmtTime(t.completed_at!)} ({timeAgo(t.completed_at!)})
            </div>
            <Badge tone="amber">Safety check</Badge>
          </div>
          {t.completed_by === user?.id ? (
            <p className="muted small">You did this task, so someone else needs to check it.</p>
          ) : rejecting === t.id ? (
            <div className="reject-box">
              <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong? e.g. back door still open" aria-label="What's wrong" />
              <div className="row">
                <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
                <button className="btn btn-danger" disabled={!note.trim() || busyId === t.id} onClick={() => act(t.id, () => tasksApi.sendBack(t.id, note))}>
                  Send back
                </button>
              </div>
            </div>
          ) : (
            <div className="row verify-actions">
              <button className="btn btn-ghost" onClick={() => { setRejecting(t.id); setNote('') }}><Icon name="x" size={16} /> Not done</button>
              <button className="btn btn-success" disabled={busyId === t.id} onClick={() => act(t.id, () => tasksApi.verify(t.id))}>
                <Icon name="shield" size={16} /> I checked, sign off
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
