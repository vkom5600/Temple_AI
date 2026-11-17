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
  const h = new Date().getHours()
  if (h < 5) return 'night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

export const greeting = (): string =>
  ({ morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' })[partOfDay()]

export const longDate = (date = new Date()): string =>
  date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

export const isToday = (iso: string | null) => !!iso && sameDay(new Date(iso), new Date())

// null = a task with no deadline
export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Any time')

// "Today", "Tomorrow", "Yesterday", or "Sat 31 Oct"
export function fmtDay(iso: string | null): string {
  if (!iso) return 'Any day'
  const d = new Date(iso)
  const offset = (days: number) => { const x = new Date(); x.setDate(x.getDate() + days); return x }
  if (sameDay(d, offset(0))) return 'Today'
  if (sameDay(d, offset(1))) return 'Tomorrow'
  if (sameDay(d, offset(-1))) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

export const fmtWhen = (iso: string | null) => (iso ? `${fmtDay(iso)}, ${fmtTime(iso)}` : 'No deadline')

// For use inside a sentence: "today at 2:00 pm", "on Sat 31 Oct at 2:00 pm"
export function fmtInline(iso: string | null): string {
  if (!iso) return 'with no deadline'
  const day = fmtDay(iso)
  return ['Today', 'Tomorrow', 'Yesterday'].includes(day) ? `${day.toLowerCase()} at ${fmtTime(iso)}` : `on ${day} at ${fmtTime(iso)}`
}

// Values for <input type="date"> and <input type="time"> in local time
const pad = (n: number) => String(n).padStart(2, '0')
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
