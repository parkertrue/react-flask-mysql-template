import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { logoutUser, logoutAllDevices, clearAuthCookies } from '../../api/services/authService'

export default function LogoutDropdown() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

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

  const endSession = async (request, label) => {
    setShowDropdown(false)
    try {
      await request()
    } catch (err) {
      console.error(`${label} error:`, err)
      // The refresh cookie is HttpOnly, so only the server can expire it.
      // If this fails too, there is nothing more the client can do.
      await clearAuthCookies().catch(() => {})
    } finally {
      logout()
      navigate('/')
    }
  }

  const handleLogout = () => endSession(logoutUser, 'Logout')
  const handleLogoutAll = () => endSession(logoutAllDevices, 'Logout all')

  return (
    <div className="logout-dropdown" ref={dropdownRef}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)} 
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
    </div>
  )
}
