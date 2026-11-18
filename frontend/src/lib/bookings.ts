import type { Booking } from '../types'

// Booking times in the designs' style: "Sat 14 Nov · 14:00 – 18:00", "4 hours total".
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

export const bookingDay = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
export const bookingTimes = (b: Pick<Booking, 'starts_at' | 'ends_at'>) => `${hhmm(b.starts_at)} – ${hhmm(b.ends_at)}`
export const bookingSlot = (b: Pick<Booking, 'starts_at' | 'ends_at'>) => `${bookingDay(b.starts_at)} · ${bookingTimes(b)}`

export function bookingLength(b: Pick<Booking, 'starts_at' | 'ends_at'>): string {
  const mins = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h ? `${h} hour${h > 1 ? 's' : ''}` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''} total`
}

export const STATUS_LABEL: Record<Booking['status'], { label: string; cls: string }> = {
  pending: { label: 'Waiting for approval', cls: 'pill-saf' },
  approved: { label: 'Confirmed', cls: 'pill-grn' },
  declined: { label: 'Not approved', cls: 'pill-red' },
  cancelled: { label: 'Cancelled', cls: 'pill-soft' },
}

// "IHC-2026-0042", the reference shown to the person who asked (M13)
export const bookingRef = (b: Pick<Booking, 'id' | 'created_at'>) => `IHC-${new Date(b.created_at).getFullYear()}-${String(b.id).padStart(4, '0')}`

// Local <input type="date"> + "HH:MM" → ISO
export const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString()
