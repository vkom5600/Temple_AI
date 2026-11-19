import { useState } from 'react'
import { questionsApi } from '../api/endpoints'
import { DESIGNATION_LABELS, ROLE_LABELS } from '../constants'
import { timeAgo } from '../lib/format'
import { Icon } from './ui'
import type { Question } from '../types'

// M6 in the Action Center: a staff question with an inline Answer box.
export default function QuestionRow({ q, canAnswer, phone = false, act }: {
  q: Question
  canAnswer: boolean
  phone?: boolean
  act: (action: () => Promise<{ message: string }>) => void
}) {
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const who = `${q.asked_by_name}${q.asked_by_designation ? ` (${DESIGNATION_LABELS[q.asked_by_designation]})` : q.asked_by_role === 'volunteer' ? ` (${ROLE_LABELS.volunteer})` : ''}`
  const box = open && (
    <div className="q-answer">
      <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${q.asked_by_name.split(' ')[0]}…`} autoFocus aria-label="Your answer" />
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={!reply.trim()} onClick={() => act(() => questionsApi.answer(q.id, reply.trim()))}><Icon name="send" size={14} /> Send answer</button>
      </div>
    </div>
  )

  if (phone) {
    return (
      <div className="m-task s-ind">
        <div className="txt">
          <div className="t">"{q.question}"</div>
          <div className="m">{who} · {timeAgo(q.created_at)}{q.task_title ? ` · about "${q.task_title}"` : ''}</div>
          {box}
        </div>
        {canAnswer && !open && <button className="btn btn-primary" onClick={() => setOpen(true)}>Answer</button>}
      </div>
    )
  }
  return (
    <div className="attn-row">
      <span className="tile-ic ic-ind"><Icon name="message" size={20} /></span>
      <div className="grow">
        <div className="attn-name">"{q.question}"</div>
        <div className="attn-meta"><span>Question from {who} · {timeAgo(q.created_at)}</span>{q.task_title && <span>· about "{q.task_title}"</span>}</div>
        {box}
      </div>
      {canAnswer && !open && <div className="attn-actions"><button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="message" size={16} /> Answer</button></div>}
    </div>
  )
}
