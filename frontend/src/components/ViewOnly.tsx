import { Icon } from './ui'

// T1 "View only" chip next to a page title (committee member with View access)
export default function ViewOnly() {
  return <span className="view-only"><Icon name="search" size={13} /> View only</span>
}
