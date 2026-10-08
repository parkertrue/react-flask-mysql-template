import { useHealth } from '../../hooks/useHealth'

// Demo of a polled backend call, like the notes feature: delete it with
// useHealth and healthService when starting a real app. The backend's
// /api/health stays, since the Docker healthchecks and Playwright use it.
export default function ApiStatus() {
  const { status } = useHealth()

  return (
    <div className="api-status">
      <p>
        API Status: <span data-testid="api-status">{status}</span>
      </p>
    </div>
  )
}
