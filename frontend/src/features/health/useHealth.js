import { useState, useEffect } from 'react'
import { checkHealth } from './healthService'

// The API's status, checked on mount and every 30 seconds. "checking" shows
// on the first check only: a poll keeps the last answer until it gets a new
// one, so the status line changes, and is read out, only when the API does.
export function useHealth() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkHealth()
        setStatus(data.status)
      } catch {
        setStatus('error')
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return status
}
