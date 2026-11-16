import { useStore } from './store.jsx'
import { isAdmin } from './lib'
import Login from './screens/Login.jsx'
import StaffHome from './screens/StaffHome.jsx'
import AdminShell from './admin/AdminShell.jsx'
import { Icon } from './ui.jsx'

export default function App() {
  const { me, toast } = useStore()
  return (
    <>
      {!me ? <Login /> : isAdmin(me) ? <AdminShell /> : <StaffHome />}
      {toast && (
        <div className="toast" key={toast.id} role="status">
          <Icon name="bell" size={16} /> {toast.text}
        </div>
      )}
    </>
  )
}
