import { useHealth } from './useHealth'
import './health.css'

// An example like the notes feature (a polled backend call): delete this
// folder when starting a real app. The backend's /api/health stays, since the
// Docker healthchecks and Playwright use it.
export default function ApiStatus() {
  const status = useHealth()

  return (
    <div className="api-status">
      <p role="status">API status: {status}</p>
    </div>
  )
}
