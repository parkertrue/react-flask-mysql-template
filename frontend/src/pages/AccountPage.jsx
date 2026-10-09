import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { logoutAllDevices, clearAuthCookies } from '@/auth/authService'
import { getErrorMessage } from '@/api/errors'
import PageTitle from '@/components/layout/PageTitle'

export default function AccountPage() {
  const { email, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const handleLogoutAll = async () => {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      await logoutAllDevices()
    } catch (err) {
      // Signing out other devices happens only on the server, so if that
      // failed they are all still signed in: say so, and keep this session
      // for a retry. A 401 means this session has ended anyway.
      if (err.response?.status !== 401) {
        setError(getErrorMessage(err))
        setPending(false)
        return
      }
      // HttpOnly, so only the server can expire the refresh cookie
      await clearAuthCookies().catch(() => {})
    }
    navigate('/')
    logout()
  }

  // aria-disabled rather than disabled while busy: a disabled button drops
  // keyboard focus
  return (
    <div className="account-page">
      <PageTitle>Account</PageTitle>
      <h1>Account</h1>
      <p className="account-email">Signed in as <strong>{email}</strong></p>

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Sessions</h2>
        <p>Log out everywhere this account is signed in, including this browser.</p>
        {error && <div className="error-message" role="alert">{error}</div>}
        <button
          type="button"
          onClick={handleLogoutAll}
          aria-disabled={pending}
          className="btn btn-danger"
        >
          {pending ? 'Logging out...' : 'Logout All Devices'}
        </button>
      </section>
    </div>
  )
}
