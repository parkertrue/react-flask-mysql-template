import { useHealth } from './useHealth'
import './api-status.css'

// Demo of a polled backend call, like the notes feature: delete this folder
// when starting a real app. The backend's /api/health stays, since the
// Docker healthchecks and Playwright use it.
export default function ApiStatus() {
  const status = useHealth()

  return (
    <div className="api-status">
      <p>API Status: {status}</p>
    </div>
  )
}
