import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { loginUser } from '../api/services/authService'
import { getErrorMessage } from '../api/errors'
import { 
  validateEmail, 
  validatePassword, 
  PASSWORD_MAX_LENGTH, 
  EMAIL_MAX_LENGTH 
} from '../utils/validation'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/notes" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate inputs
    const emailErrors = validateEmail(email)
    const passwordErrors = validatePassword(password)
    
    if (emailErrors.length > 0 || passwordErrors.length > 0) {
      setErrors({
        email: emailErrors[0],
        password: passwordErrors[0]
      })
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      const data = await loginUser(email, password)
      login(data.access_token, data.refresh_csrf, email)
      navigate('/notes')
    } catch (err) {
      setErrors({ general: getErrorMessage(err) })
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) {
                    setErrors(prev => ({ ...prev, email: undefined }))
                  }
                }}
                disabled={isLoading}
                required
                className={`form-input ${errors.email ? 'error' : ''}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                maxLength={EMAIL_MAX_LENGTH}
              />
              {errors.email && (
                <div className="field-error" id="email-error" data-testid="email-error">
                  {errors.email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) {
                    setErrors(prev => ({ ...prev, password: undefined }))
                  }
                }}
                disabled={isLoading}
                required
                className={`form-input ${errors.password ? 'error' : ''}`}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                maxLength={PASSWORD_MAX_LENGTH}
              />
              {errors.password && (
                <div className="field-error" id="password-error" data-testid="password-error">
                  {errors.password}
                </div>
              )}
            </div>

            {errors.general && (
              <div className="error-message" data-testid="error-message">
                {errors.general}
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