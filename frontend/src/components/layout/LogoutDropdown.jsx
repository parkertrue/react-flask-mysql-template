import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { logoutUser, logoutAllDevices } from '../../api/services/authService'

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
