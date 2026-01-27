import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { registerUser } from '../api/services/authService'
import { getErrorMessage } from '../api/errors'
import { 
  validateEmail, 
  validatePassword, 
  validatePasswordMatch,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH 
} from '../utils/validation'

export default function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/notes" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate all inputs
    const emailErrors = validateEmail(email)
    const passwordErrors = validatePassword(password)
    const matchErrors = validatePasswordMatch(password, confirmPassword)
    
    if (emailErrors.length > 0 || passwordErrors.length > 0 || matchErrors.length > 0) {
      setErrors({
        email: emailErrors[0],
        password: passwordErrors[0],
        confirmPassword: matchErrors[0]
      })
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      await registerUser(email, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setErrors({ general: getErrorMessage(err) })
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
                minLength={8}
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

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (errors.confirmPassword) {
                    setErrors(prev => ({ ...prev, confirmPassword: undefined }))
                  }
                }}
                disabled={isLoading}
                minLength={8}
                required
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                maxLength={PASSWORD_MAX_LENGTH}
              />
              {errors.confirmPassword && (
                <div className="field-error" id="confirm-password-error" data-testid="confirm-password-error">
                  {errors.confirmPassword}
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