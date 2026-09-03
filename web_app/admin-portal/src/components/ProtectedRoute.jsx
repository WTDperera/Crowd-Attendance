import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function ProtectedRoute() {
  const { isAuthed } = useAuth()

  if (!isAuthed) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
