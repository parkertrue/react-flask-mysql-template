import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { registerUser } from '../api/services/authService'
import { getErrorMessage } from '../api/errors'

export default function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/notes" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      await registerUser(email, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="register-page">
        <div className="auth-container">
          <div className="success-message" data-testid="success-message">
            Registration successful! Redirecting to login...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="register-page">
      <div className="auth-container">
        <div className="auth-card">
          <h2>Register</h2>

          <form onSubmit={handleSubmit} className="auth-form" data-testid="register-form">
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
                minLength={8}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                minLength={8}
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
              {isLoading ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}