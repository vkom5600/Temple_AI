import { useState } from 'react'
import { issuesApi, tasksApi } from '../../api/endpoints'
import { ISSUE_REASONS } from '../../constants'
import { useToast } from '../Toast'
import { ErrorNote, Icon, Modal } from '../ui'
import type { Task } from '../../types'

// "Can't do this task?" (task given) or a general "Report a problem" (no task).
// Either way the chairman and committee are told straight away.
export default function ProblemSheet({ task, onClose, onSent }: { task: Task | null; onClose: () => void; onSent: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState(task ? '' : ISSUE_REASONS[0])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = reason && (text.trim() || reason !== 'Other') && !busy

  const send = async () => {
    setError('')
    setBusy(true)
    const description = text.trim() || reason
    try {
      const r = task ? await tasksApi.flag(task.id, reason, description) : await issuesApi.report(reason, description)
      toast(r.message)
      onSent()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={task ? "Couldn't do this task?" : 'Report a problem'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!ok} onClick={send}>
            <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send'}
          </button>
        </>
      }
    >
      {task && <p className="sheet-task">{task.title}</p>}
      <div className="field">
        <span className="label">What happened?</span>
        <div className="chips">
          {ISSUE_REASONS.map((r) => (
            <button key={r} type="button" className={`chip ${reason === r ? 'on' : ''}`} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="label">Tell us more {reason !== 'Other' && <span className="muted">(optional)</span>}</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. The side door lock is broken" maxLength={2000} />
      </label>
      <p className="muted small">The chairman and committee will see this straight away.</p>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
