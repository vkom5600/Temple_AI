import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Modal, Icon } from '../ui.jsx'

const REASONS = ['Something is broken', 'Supplies missing', 'Not enough time', 'Other']

// Used for "I couldn't do this task" (task given) and for a general "Report a problem" (no task).
export default function ProblemSheet({ task, onClose }) {
  const { act } = useStore()
  const [reason, setReason] = useState(task ? '' : 'Something is broken')
  const [text, setText] = useState('')
  const ok = reason && (text.trim() || reason !== 'Other')

  const send = () => {
    const msg = text.trim() || reason
    act({
      type: 'flag',
      id: task?.id,
      reason,
      text: msg,
      log: task ? `Flagged "${task.title}": ${msg}` : `Reported a problem: ${msg}`,
      toast: 'Sent to the chairman and committee',
    })
    onClose()
  }

  return (
    <Modal
      title={task ? "Couldn't do this task?" : 'Report a problem'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!ok} onClick={send}>
            <Icon name="send" size={16} /> Send
          </button>
        </>
      }
    >
      {task && <p className="sheet-task">{task.title}</p>}
      <div className="field">
        <span className="label">What happened?</span>
        <div className="chips">
          {REASONS.map((r) => (
            <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="label">Tell us more {reason !== 'Other' && <span className="muted">(optional)</span>}</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. The side door lock is broken" />
      </label>
      <p className="muted small">The chairman and committee will see this straight away.</p>
    </Modal>
  )
}
