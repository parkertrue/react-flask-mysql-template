import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LogoutDropdown from './LogoutDropdown'

export default function Navbar() {
  const { email, isAuthenticated } = useAuth()
  const location = useLocation()

  const isHome = location.pathname === '/'
  const isLogin = location.pathname === '/login'
  const isRegister = location.pathname === '/register'

  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-container">
        <div className="navbar-links">
          {isAuthenticated && isHome && (
            <Link to="/notes" className="nav-link">My Notes</Link>
          )}

          {!isHome && (
            <Link to="/" className="nav-link">Home</Link>
          )}

          {!isAuthenticated && !isLogin && (
            <Link to="/login" className="nav-link">Login</Link>
          )}

          {!isAuthenticated && !isRegister && (
            <Link to="/register" className="nav-link">Register</Link>
          )}
        </div>

        {isAuthenticated && (
          <div className="navbar-user" data-testid="navbar-user">
            <span className="user-email">{email}</span>
            <LogoutDropdown />
          </div>
        )}
      </div>
    </nav>
  )
}