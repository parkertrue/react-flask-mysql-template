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
    <div>
      <div>
        <h2>Login</h2>

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
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p>
          Don't have an account?{' '}
          <Link to="/register">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}