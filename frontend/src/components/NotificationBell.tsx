import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsApi } from '../api/endpoints'
import { timeAgo } from '../lib/format'
import type { AppNotification } from '../types'
import { Empty, Icon } from './ui'

const POLL_MS = 60_000

// Bell with unread count; opens a panel listing the latest notifications.
// align="up" opens the panel above the bell (used in the sidebar footer).
export default function NotificationBell({ align = 'down' }: { align?: 'down' | 'up' }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then((r) => setUnread(r.unreadCount)).catch(() => {})
  }, [])

  // Poll the count while the page is visible.
  useEffect(() => {
    refreshCount()
    const id = setInterval(() => document.visibilityState === 'visible' && refreshCount(), POLL_MS)
    return () => clearInterval(id)
  }, [refreshCount])

  // Load the list whenever the panel opens.
  useEffect(() => {
    if (!open) return
    setError('')
    notificationsApi
      .list()
      .then((r) => setItems(r.notifications))
      .catch((e: Error) => setError(e.message))
  }, [open])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markRead = async (n: AppNotification) => {
    if (n.is_read) return
    setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null)
    setUnread((c) => Math.max(0, c - 1))
    await notificationsApi.markRead(n.id).catch(refreshCount)
  }

  const markAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null)
    setUnread(0)
    await notificationsApi.markAllRead().catch(refreshCount)
  }

  return (
    <div className="bell" ref={wrapRef}>
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className={`bell-panel bell-${align}`} role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="link-btn" onClick={markAll}>Mark all read</button>}
          </div>
          {error && <p className="red small">{error}</p>}
          {!items && !error && <p className="muted small">Loading…</p>}
          {items?.length === 0 && <Empty icon="bell">Nothing new.</Empty>}
          {items && items.length > 0 && (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button className={`bell-item ${n.is_read ? '' : 'unread'}`} onClick={() => markRead(n)}>
                    <span className="strong">{n.title}</span>
                    {n.message && <span className="small">{n.message}</span>}
                    <span className="muted small">{timeAgo(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
