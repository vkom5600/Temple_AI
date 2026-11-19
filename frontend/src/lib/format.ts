import { ukAddDays, ukDateKey, ukDay, ukParts, ukSameDay, ukTime } from './uk'

// "just now", "5 min ago", "3 hr ago", "2 days ago"
export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export const partOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const h = ukParts().h
  if (h < 5) return 'night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

export const greeting = (): string =>
  ({ morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' })[partOfDay()]

export const longDate = (date = new Date()): string =>
  ukDay(date, { weekday: 'long', day: 'numeric', month: 'long' })

const sameDay = ukSameDay

export const isToday = (iso: string | null) => !!iso && sameDay(new Date(iso), new Date())

// null = a task with no deadline
export const fmtTime = (iso: string | null) => (iso ? ukTime(new Date(iso), { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Any time')

// "Today", "Tomorrow", "Yesterday", or "Sat 31 Oct"
export function fmtDay(iso: string | null): string {
  if (!iso) return 'Any day'
  const d = new Date(iso)
  const offset = (days: number) => ukAddDays(new Date(), days)
  if (sameDay(d, offset(0))) return 'Today'
  if (sameDay(d, offset(1))) return 'Tomorrow'
  if (sameDay(d, offset(-1))) return 'Yesterday'
  return ukDay(d)
}

export const fmtWhen = (iso: string | null) => (iso ? `${fmtDay(iso)}, ${fmtTime(iso)}` : 'No deadline')

// For use inside a sentence: "today at 2:00 pm", "on Sat 31 Oct at 2:00 pm"
export function fmtInline(iso: string | null): string {
  if (!iso) return 'with no deadline'
  const day = fmtDay(iso)
  return ['Today', 'Tomorrow', 'Yesterday'].includes(day) ? `${day.toLowerCase()} at ${fmtTime(iso)}` : `on ${day} at ${fmtTime(iso)}`
}

// Values for <input type="date"> and <input type="time">, in UK time
export const toDateInput = (d: Date) => ukDateKey(d)
export const toTimeInput = (d: Date) => { const p = ukParts(d); return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}` }
