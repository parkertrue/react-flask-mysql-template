import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { logoutUser, clearAuthCookies } from './authService'

export default function LogoutButton() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  // This device's session ends even if the server cannot be reached
  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch {
      // The refresh cookie is HttpOnly, so only the server can expire it.
      // If this fails too, there is nothing more the client can do.
      await clearAuthCookies().catch(() => {})
    }
    navigate('/')
    logout()
  }

  return (
    <button type="button" onClick={handleLogout} className="btn btn-danger btn-small">
      Logout
    </button>
  )
}
