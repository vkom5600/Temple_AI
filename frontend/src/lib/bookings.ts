import type { Booking } from '../types'
import { ukDay, ukFromInputs, ukParts, ukTime } from './uk'

// Booking times in the designs' style: "Sat 14 Nov · 14:00 – 18:00", "4 hours total".
const hhmm = (iso: string) => ukTime(new Date(iso))

export const bookingDay = (iso: string) => ukDay(new Date(iso))
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
export const bookingRef = (b: Pick<Booking, 'id' | 'created_at'>) => `IHC-${ukParts(new Date(b.created_at)).y}-${String(b.id).padStart(4, '0')}`

// Local <input type="date"> + "HH:MM" → ISO
export const toIso = (date: string, time: string) => ukFromInputs(date, time).toISOString()
