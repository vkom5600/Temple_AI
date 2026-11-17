import type { ReactNode } from 'react'
import { BRAND } from '../branding'
import { Gopuram, Mandala, Toran } from './Ornaments'

// Sign-in and registration: a temple gateway banner (two faded gopurams, a garland
// along the top) with the page's card sitting over its lower edge.
export default function EntryShell({ children }: { children: ReactNode }) {
  return (
    <div className="entry">
      <header className="entry-band">
        <Toran />
        <Mandala />
        <Gopuram className="gopuram-left" />
        <Gopuram className="gopuram-right" />
        <div className="entry-brand">
          <span className="brand-mark">ॐ</span>
          <div>
            <div className="brand-name">{BRAND.templeName}</div>
            <div className="brand-sub">{BRAND.tagline}</div>
          </div>
        </div>
      </header>
      <main className="entry-body">{children}</main>
    </div>
  )
}
