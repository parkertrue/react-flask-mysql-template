import { useState, useEffect } from 'react'
import { checkHealth } from './healthService'

// The API's status, checked on mount and every 30 seconds
export function useHealth() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const fetchHealth = async () => {
      setStatus('checking')
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
