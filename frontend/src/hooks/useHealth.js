import { useState, useEffect } from 'react'
import { checkHealth } from '../api/services/healthService'

export function useHealth() {
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchHealth = async () => {
        setStatus('checking')

        try {
            const data = await checkHealth()
            setStatus(data.status)
            setError(null)
        } catch (err) {
            setStatus('error')
            setError(err.message)
        }
    }

    fetchHealth()

    // Poll health status every 30 seconds
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return { status, error }
}
