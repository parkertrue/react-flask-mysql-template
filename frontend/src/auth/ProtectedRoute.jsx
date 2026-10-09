import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

// The parent route of every page that needs a session
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // GuestRoute brings the user back here once they log in
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
