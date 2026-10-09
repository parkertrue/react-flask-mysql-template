import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

// Where logging in leads, unless ProtectedRoute sent the user from elsewhere
const AFTER_LOGIN_PATH = '/notes'

// The parent route of the login and register pages, which a signed-in user
// has no use for. Logging in re-renders it, which is what moves the user on.
export default function GuestRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (isAuthenticated) {
    return <Navigate to={location.state?.from ?? AFTER_LOGIN_PATH} replace />
  }

  return <Outlet />
}
