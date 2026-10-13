import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getAccount, logoutAllDevices, clearAuthCookies } from '@/auth/authService'
import { getErrorMessage } from '@/api/errors'
import PageTitle from '@/components/layout/PageTitle'

export default function AccountPage() {
  const { email, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [account, setAccount] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    getAccount()
      .then(setAccount)
      .catch(err => setLoadError(getErrorMessage(err)))
  }, [])

  const handleLogoutAll = async () => {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await logoutAllDevices()
    } catch (err) {
      // Signing out other devices happens only on the server, so if that
      // failed they are all still signed in: say so, and keep this session
      // for a retry. A 401 means this session has ended anyway.
      if (err.response?.status !== 401) {
        setError(getErrorMessage(err))
        setSubmitting(false)
        return
      }
      // HttpOnly, so only the server can expire the refresh cookie
      await clearAuthCookies().catch(() => {})
    }
    navigate('/')
    logout()
  }

  return (
    <div className="account-page">
      <PageTitle>Account</PageTitle>
      <h1>Account</h1>
      <p className="account-email">Signed in as <strong>{email}</strong></p>
      {/* One persistent live region, so the loaded details are announced */}
      <p role="status">
        {account && (
          <>
            Member since{' '}
            <time dateTime={account.created_at}>
              {new Date(account.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </time>
          </>
        )}
        {!account && !loadError && 'Loading account details...'}
      </p>
      {loadError && <div className="error-message" role="alert">{loadError}</div>}

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Sessions</h2>
        <p>Log out everywhere this account is signed in, including this browser.</p>
        {error && <div className="error-message" role="alert">{error}</div>}
        <button
          type="button"
          onClick={handleLogoutAll}
          aria-disabled={submitting}
          className="btn btn-danger"
        >
          {submitting ? 'Logging out...' : 'Log out all devices'}
        </button>
      </section>
    </div>
  )
}
