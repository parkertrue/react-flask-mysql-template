import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useHealth } from '../hooks/useHealth'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const { status } = useHealth()

  return (
    <div>
      <h1>Welcome to Flask + React + MySQL Template App</h1>
      <p>A simple note-taking application with dev and prod configurations.</p>
      <p>
        API Status: <span>{status}</span>
      </p>

      {isAuthenticated ? (
        <Link to="/notes">
          View My Notes
        </Link>
      ) : (
        <div>
          <Link to="/register">
            Get Started
          </Link>
          <Link to="/login">
            Login
          </Link>
        </div>
      )}
    </div>
  )
}