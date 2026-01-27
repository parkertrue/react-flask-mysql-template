import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useHealth } from '../useHealth'
import { checkHealth } from '../../api/services/healthService'

vi.mock('../../api/services/healthService')

describe('useHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with checking status', () => {
    checkHealth.mockImplementation(() => new Promise(() => {}))
    
    const { result } = renderHook(() => useHealth())

    expect(result.current.status).toBe('checking')
    expect(result.current.error).toBeNull()
  })

  it('should fetch health status on mount', async () => {
    checkHealth.mockResolvedValue({ status: 'healthy' })

    const { result } = renderHook(() => useHealth())

    await waitFor(() => {
      expect(result.current.status).toBe('healthy')
    })

    expect(checkHealth).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
  })

  it('should handle health check error', async () => {
    checkHealth.mockRejectedValue(new Error('Connection failed'))

    const { result } = renderHook(() => useHealth())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    expect(result.current.error).toBe('Connection failed')
  })

  it('should poll health status every 30 seconds', async () => {
    vi.useFakeTimers()
    checkHealth.mockResolvedValue({ status: 'healthy' })

    renderHook(() => useHealth())

    // Wait for initial call
    await vi.waitFor(() => {
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    // Advance timer and run pending timers
    await vi.advanceTimersByTimeAsync(30000)

    expect(checkHealth).toHaveBeenCalledTimes(2)

    // Advance again
    await vi.advanceTimersByTimeAsync(30000)

    expect(checkHealth).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })

  it('should clear interval on unmount', async () => {
    checkHealth.mockResolvedValue({ status: 'healthy' })

    const { unmount } = renderHook(() => useHealth())

    await waitFor(() => {
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    const callCount = checkHealth.mock.calls.length
    unmount()

    // Wait to ensure no more calls
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(checkHealth).toHaveBeenCalledTimes(callCount)
  })

  it('should update status when health check returns different value', async () => {
    vi.useFakeTimers()
    checkHealth
      .mockResolvedValueOnce({ status: 'healthy' })
      .mockResolvedValueOnce({ status: 'degraded' })

    const { result } = renderHook(() => useHealth())

    await vi.waitFor(() => {
      expect(result.current.status).toBe('healthy')
    })

    await vi.advanceTimersByTimeAsync(30000)

    await vi.waitFor(() => {
      expect(result.current.status).toBe('degraded')
    })

    vi.useRealTimers()
  })

  it('should clear error when health check succeeds after failure', async () => {
    vi.useFakeTimers()
    checkHealth
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ status: 'healthy' })

    const { result } = renderHook(() => useHealth())

    await vi.waitFor(() => {
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Failed')
    })

    await vi.advanceTimersByTimeAsync(30000)

    await vi.waitFor(() => {
      expect(result.current.status).toBe('healthy')
      expect(result.current.error).toBeNull()
    })

    vi.useRealTimers()
  })
})