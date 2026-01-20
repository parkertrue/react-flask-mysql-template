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
      <div>
        <div>
          Registration successful! Redirecting to login...
        </div>
      </div>
    )
  }

  return (
    <div>
      <div>
        <h2>Register</h2>

        <form onSubmit={handleSubmit}>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              minLength={8}
            />
          </div>

          <div>
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              minLength={8}
              required
            />
          </div>

          {error && (
            <div>
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p>
          Already have an account?{' '}
          <Link to="/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}