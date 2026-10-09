import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import PageTitle from '@/components/layout/PageTitle'
import ApiStatus from '@/features/health/ApiStatus'

export default function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="home-page">
      <PageTitle />
      <div className="home-content">
        <h1>Welcome to Flask + React + MySQL Template App</h1>
        <p>A simple note-taking application with prod, dev, and testing configurations.</p>
        <ApiStatus />

        <div className="home-actions">
          {isAuthenticated ? (
            <Link to="/notes" className="btn btn-primary">View My Notes</Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-secondary">Login</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
