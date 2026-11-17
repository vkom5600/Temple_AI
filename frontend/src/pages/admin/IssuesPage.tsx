import { useCallback, useEffect, useState } from 'react'
import { issuesApi } from '../../api/endpoints'
import { TASK_GROUP_LABELS } from '../../constants'
import { fmtWhen, timeAgo } from '../../lib/format'
import { suggestGroup, suggestedTitle } from '../../lib/tasks'
import { useAdminContext } from '../../layouts/AdminLayout'
import { useToast } from '../../components/Toast'
import { Badge, Empty, ErrorNote, Icon, Modal, Spinner } from '../../components/ui'
import ConvertIssueForm from '../../components/tasks/ConvertIssueForm'
import type { Issue } from '../../types'

// Problems staff reported, or tasks they couldn't do. Resolve, or turn into a task.
export default function IssuesPage() {
  const toast = useToast()
  const { refreshSummary } = useAdminContext()
  const [show, setShow] = useState<'open' | 'handled'>('open')
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [error, setError] = useState('')
  const [converting, setConverting] = useState<Issue | null>(null)
  const [resolving, setResolving] = useState<Issue | null>(null)

  const load = useCallback(() => {
    setIssues(null)
    issuesApi.list(show).then((r) => setIssues(r.issues)).catch((e: Error) => setError(e.message))
  }, [show])

  useEffect(load, [load])

  const changed = () => { load(); refreshSummary() }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Issues</h1>
          <p className="muted">Problems staff reported, or tasks they couldn't finish. Sort them, or turn them into a task for the right person.</p>
        </div>
      </header>

      <div className="seg seg-inline" role="tablist">
        <button role="tab" aria-selected={show === 'open'} className={show === 'open' ? 'on' : ''} onClick={() => setShow('open')}>Open</button>
        <button role="tab" aria-selected={show === 'handled'} className={show === 'handled' ? 'on' : ''} onClick={() => setShow('handled')}>Handled</button>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!issues && !error && <Spinner />}
      {issues?.length === 0 && <Empty icon="check">No {show} issues.</Empty>}

      <div className="stack">
        {issues?.map((i) => {
          const group = suggestGroup(i.description)
          return (
            <div key={i.id} className="card issue">
              <div className="grow">
                <div className="row"><Badge tone="red">{i.category}</Badge><span className="muted small">{i.reported_by_name ?? 'Someone'} · {timeAgo(i.created_at)}</span></div>
                <div className="issue-text">{i.description}</div>
                {i.task_title && <div className="meta">On task: {i.task_title}</div>}
                {i.status === 'open' && (
                  <div className="suggest"><Icon name="sparkle" size={14} /> Suggested: "{suggestedTitle(i.description)}" for <b>{TASK_GROUP_LABELS[group]}</b></div>
                )}
                {i.status === 'converted' && (
                  <div className="meta">
                    → Task "{i.created_task_title}" for {i.created_task_group ? TASK_GROUP_LABELS[i.created_task_group] : i.created_task_assignee_name} · {i.resolved_by_name}, {fmtWhen(i.resolved_at!)}
                  </div>
                )}
                {i.status === 'resolved' && (
                  <div className="meta">Resolved by {i.resolved_by_name}, {fmtWhen(i.resolved_at!)}{i.resolution_note && `: ${i.resolution_note}`}</div>
                )}
              </div>
              {i.status === 'open' && (
                <div className="col-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setConverting(i)}>Create task</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setResolving(i)}>Mark resolved</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {converting && <ConvertIssueForm issue={converting} onClose={() => setConverting(null)} onDone={(m) => { toast(m); setConverting(null); changed() }} />}

      {resolving && <ResolveDialog issue={resolving} onClose={() => setResolving(null)} onDone={(m) => { toast(m); setResolving(null); changed() }} />}
    </div>
  )
}

function ResolveDialog({ issue, onClose, onDone }: { issue: Issue; onClose: () => void; onDone: (message: string) => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const r = await issuesApi.resolve(issue.id, note)
      onDone(r.message)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Mark as resolved"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Resolve'}</button>
        </>
      }
    >
      <p className="sheet-task">{issue.description}</p>
      {issue.task_title && issue.task_status === 'flagged' && (
        <p className="muted small">"{issue.task_title}" will go back on their list so they can try again.</p>
      )}
      <label className="field">
        <span className="label">What was done? <span className="muted">(optional, {issue.reported_by_name ?? 'they'} will see this)</span></span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Ordered more ghee, arriving Thursday" autoFocus />
      </label>
      <ErrorNote>{error}</ErrorNote>
    </Modal>
  )
}
