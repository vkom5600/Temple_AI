import { useState } from 'react'
import { questionsApi } from '../api/endpoints'
import { ErrorNote, Icon, Modal } from './ui'
import type { Task } from '../types'

// M6 Ask a question (staff phone): the question goes to the chairman and committee,
// shows in their Action Center, and the answer comes back here and as a notification.
export default function QuestionSheet({ tasks, onClose, onSent }: { tasks: Task[]; onClose: () => void; onSent: (message: string) => void }) {
  const [question, setQuestion] = useState('')
  const [taskId, setTaskId] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await questionsApi.ask(question.trim(), taskId || null)
      onSent(r.message)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Ask a question" subtitle="It goes to the chairman and committee. You'll get the answer here." size="sheet" onClose={onClose}
      footer={<button className="btn btn-primary btn-big" disabled={question.trim().length < 3 || busy} onClick={send}><Icon name="send" size={18} /> {busy ? 'Sending…' : 'Send question'}</button>}>
      <div className="stack" style={{ gap: 14 }}>
        <label className="field">
          <span className="label">Your question</span>
          <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="e.g. Where are the spare diyas kept?" autoFocus />
        </label>
        {tasks.length > 0 && (
          <label className="field">
            <span className="label">About a task? <span className="muted">(optional)</span></span>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Not about a task</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}
