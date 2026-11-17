import { useAdminContext } from '../../layouts/AdminLayout'
import VerifyList from '../../components/tasks/VerifyList'

export default function SignoffsPage() {
  const { refreshSummary } = useAdminContext()
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sign-offs</h1>
          <p className="muted">Safety tasks marked done that need a second person to check them. You can't sign off your own.</p>
        </div>
      </header>
      <VerifyList onChanged={refreshSummary} />
    </div>
  )
}
