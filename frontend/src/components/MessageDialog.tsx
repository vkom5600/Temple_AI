import { useState } from 'react'
import { notificationsApi } from '../api/endpoints'
import { useToast } from './Toast'
import { ErrorNote, Icon, Modal } from './ui'

// A message to one or a few people (P2 "Message Ramesh", People "Remind").
// It appears on their phone like a broadcast: "Message from Raghu".
export default function MessageDialog({ to, names, initial = '', onClose }: { to: number[]; names: string[]; initial?: string; onClose: () => void }) {
  const toast = useToast()
  const [message, setMessage] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    setError('')
    setBusy(true)
    try {
      toast((await notificationsApi.message(to, message.trim())).message)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const who = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
  return (
    <Modal title={`Message ${who}`} subtitle="It shows at the top of their phone and as a notification." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!message.trim() || busy} onClick={send}><Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send'}</button></>}>
      <label className="field">
        <span className="label">Message <span className="muted">({280 - message.length} left)</span></span>
        <textarea rows={4} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus />
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
