import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { logoutUser, clearAuthCookies } from './authService'

export default function LogoutButton() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  // This device's session ends even if the server cannot be reached. Either
  // way the button goes with the session, so it never needs to be un-busied.
  const handleLogout = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await logoutUser()
    } catch {
      await clearAuthCookies()
    }
    // Render home before the session ends, or a protected page still on screen
    // sends its ProtectedRoute to /login. A plain navigate is a transition,
    // which logout()'s re-render would overtake; flushSync renders it now.
    await navigate('/', { flushSync: true })
    logout()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-disabled={submitting}
      className="btn btn-danger btn-small"
    >
      {submitting ? 'Logging out...' : 'Log out'}
    </button>
  )
}
