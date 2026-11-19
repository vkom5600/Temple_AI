import { useState } from 'react'
import { tasksApi } from '../../api/endpoints'
import { ErrorNote, Icon, Modal, type IconName } from '../ui'
import type { Task } from '../../types'

// M4 I need help (design: screens/36_M4): one tap sends the problem to the chairman and
// committee (it lands in the Action Center); the task shows "Couldn't do" until it's sorted.
const OPTIONS: { label: string; category: string; icon: IconName }[] = [
  { label: "I can't find the things I need", category: 'Supplies missing', icon: 'inbox' },
  { label: "I don't have time", category: 'Not enough time', icon: 'clock' },
  { label: 'Something is broken', category: 'Something is broken', icon: 'alert' },
  { label: 'This task needs 2 people', category: 'Needs another person', icon: 'users' },
  { label: 'Someone else should do this', category: 'Someone else should do it', icon: 'user' },
]

export default function HelpSheet({ task, onClose, onSent }: { task: Task; onClose: () => void; onSent: () => void }) {
  const [note, setNote] = useState('')
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const send = async (category: string, label: string) => {
    setError('')
    setBusy(true)
    try {
      await tasksApi.flag(task.id, category, note.trim() ? `${label}. ${note.trim()}` : label)
      setSent(true)
      onSent()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="What do you need help with?"
      size="sheet"
      onClose={onClose}
      head={
        <div>
          <h2 className="row" style={{ gap: 10, fontSize: 22 }}><Icon name="alert" size={22} /> What do you need help with?</h2>
          <p className="modal-sub">Tap one option. The chairman and committee get it straight away.</p>
        </div>
      }
      footer={<button className="link-btn muted" style={{ margin: '0 auto' }} onClick={onClose}>{sent ? 'Close' : 'Cancel'}</button>}
    >
      <p className="sheet-task">{task.title}</p>
      {!sent && OPTIONS.map((o) => (
        <button key={o.category} className="help-option" disabled={busy} onClick={() => send(o.category, o.label)}>
          <Icon name={o.icon} size={20} /> <span className="grow">{o.label}</span> <Icon name="chevron-right" size={18} />
        </button>
      ))}
      {!sent && (writing ? (
        <label className="field"><span className="label">Add a note <span className="muted">(then tap an option above)</span></span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus placeholder="e.g. The ghee is finished, there's none in Stores G12" />
        </label>
      ) : (
        <button className="help-note" onClick={() => setWriting(true)}><Icon name="message" size={18} /> Add a note first</button>
      ))}
      {sent && <div className="free-ok"><Icon name="check-circle" size={18} /> Sent. You'll get a reply here.</div>}
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
