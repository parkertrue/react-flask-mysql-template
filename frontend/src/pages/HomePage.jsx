import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ApiStatus from '../components/health/ApiStatus'

export default function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="home-page">
      <div className="home-content">
        <h1>Welcome to Flask + React + MySQL Template App</h1>
        <p>A simple note-taking application with prod, dev, and testing configurations.</p>
        <ApiStatus />

        {isAuthenticated ? (
          <div className="home-actions home-actions--authenticated">
            <Link to="/notes" className="btn btn-primary">
              View My Notes
            </Link>
          </div>
        ) : (
          <div className="home-actions home-actions--guest">
            <Link to="/register" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}