import type { ReactNode } from 'react'
import { BRAND } from '../branding'
import { Gopuram } from './Ornaments'

// Sign in (G1) and Join the temple team (W2 / W3): the indigo top bar with the logo,
// as in the designs, then a single column. A faded gopuram sits behind.
export default function EntryShell({ children }: { children: ReactNode }) {
  return (
    <div className="entry">
      <Gopuram className="page-watermark" />
      <div className="accent-line" />
      <header className="entry-top">
        <img className="logo" src={BRAND.logo} alt="" />
        <div>
          <b>{BRAND.templeName}</b>
          <span>{BRAND.tagline}</span>
        </div>
      </header>
      <main className="entry-body">{children}</main>
    </div>
  )
}
