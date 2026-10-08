import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { logoutUser, logoutAllDevices, clearAuthCookies } from '../../api/services/authService'
import { getErrorMessage } from '../../api/errors'

export default function LogoutDropdown() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState(null)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
        setError(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const endSession = async (request, label, { mustSucceed = false } = {}) => {
    setShowDropdown(false)
    setError(null)
    try {
      await request()
    } catch (err) {
      console.error(`${label} error:`, err)
      // Signing out other devices happens only on the server, so if that
      // failed they are all still signed in: say so, and keep this session
      // for a retry. A 401 means this session has ended anyway.
      if (mustSucceed && err.response?.status !== 401) {
        setError(getErrorMessage(err))
        return
      }
      // The refresh cookie is HttpOnly, so only the server can expire it.
      // If this fails too, there is nothing more the client can do.
      await clearAuthCookies().catch(() => {})
    }
    logout()
    navigate('/')
  }

  const handleLogout = () => endSession(logoutUser, 'Logout')
  const handleLogoutAll = () =>
    endSession(logoutAllDevices, 'Logout all', { mustSucceed: true })

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown)
    setError(null)
  }

  return (
    <div className="logout-dropdown" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown} 
        className="btn btn-logout"
      >
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

      {error && (
        <p className="error-message logout-error" role="alert">{error}</p>
      )}
    </div>
  )
}
