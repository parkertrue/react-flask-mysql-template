import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { logoutUser } from '../../api/services/authService'

export default function Navbar() {
  const { email, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === '/'
  const isLogin = location.pathname === '/login'
  const isRegister = location.pathname === '/register'

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      logout()
      navigate('/')
    }
  }

  return (
    <nav>
      <div>
        <div>
          {isAuthenticated && isHome && (
            <Link to="/notes">My Notes</Link>
          )}

          {!isHome && (
            <Link to="/">Home</Link>
          )}

          {!isAuthenticated && !isLogin && (
            <Link to="/login">Login</Link>
          )}

          {!isAuthenticated && !isRegister && (
            <Link to="/register">Register</Link>
          )}
        </div>

        {isAuthenticated && (
          <div>
            <span>{email}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>
    </nav>
  )
}