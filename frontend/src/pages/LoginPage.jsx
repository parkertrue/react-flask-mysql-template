import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { loginUser } from '../api/services/authService'
import { getErrorMessage } from '../api/errors'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/notes" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const data = await loginUser(email, password)
      login(data.access_token, data.refresh_csrf, email)
      navigate('/notes')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="auth-container">
        <div className="auth-card">
          <h2>Login</h2>

          <form onSubmit={handleSubmit} className="auth-form" data-testid="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="form-input"
              />
            </div>

            {error && (
              <div className="error-message" data-testid="error-message">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-block"
            > 
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}