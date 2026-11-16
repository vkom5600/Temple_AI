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
