import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { logoutUser, logoutAllDevices } from '../../api/services/authService'

export default function Navbar() {
  const { email, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const isHome = location.pathname === '/'
  const isLogin = location.pathname === '/login'
  const isRegister = location.pathname === '/register'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setShowDropdown(false)
    try {
      await logoutUser()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      logout()
      navigate('/')
    }
  }

  const handleLogoutAll = async () => {
    setShowDropdown(false)
    if (!confirm('Logout from all devices?')) return
    
    try {
      await logoutAllDevices()
    } catch (err) {
      console.error('Logout all error:', err)
    } finally {
      logout()
      navigate('/')
    }
  }

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
            <div className="logout-dropdown" ref={dropdownRef}>
              <button onClick={() => setShowDropdown(!showDropdown)} className="btn btn-logout">
                Logout {showDropdown ? '▴' : '▾'}
              </button>
              
              {showDropdown && (
                <div className="dropdown-menu">
                  <button onClick={handleLogout} className="dropdown-item">
                    Logout This Device
                  </button>
                  <button onClick={handleLogoutAll} className="dropdown-item dropdown-danger">
                    Logout All Devices
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
