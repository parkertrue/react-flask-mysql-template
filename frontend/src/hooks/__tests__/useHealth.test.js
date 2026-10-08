import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useHealth } from '../useHealth'
import { checkHealth } from '../../api/services/healthService'

vi.mock('../../api/services/healthService')

// The poll's state updates happen when the timer fires, so advance the clock
// inside act() for React to apply them before the test looks
const advance = ms => act(() => vi.advanceTimersByTimeAsync(ms))

describe('useHealth', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with checking status', () => {
    checkHealth.mockImplementation(() => new Promise(() => {}))
    
    const { result } = renderHook(() => useHealth())

    expect(result.current.status).toBe('checking')
    expect(result.current.error).toBeNull()
  })

  it('should fetch health status on mount', async () => {
    checkHealth.mockResolvedValue({ status: 'ok' })

    const { result } = renderHook(() => useHealth())

    await waitFor(() => {
      expect(result.current.status).toBe('ok')
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
    checkHealth.mockResolvedValue({ status: 'ok' })

    renderHook(() => useHealth())
    await advance(0)
    expect(checkHealth).toHaveBeenCalledTimes(1)

    await advance(30000)
    expect(checkHealth).toHaveBeenCalledTimes(2)

    await advance(30000)
    expect(checkHealth).toHaveBeenCalledTimes(3)
  })

  it('should clear interval on unmount', async () => {
    vi.useFakeTimers()
    checkHealth.mockResolvedValue({ status: 'ok' })

    const { unmount } = renderHook(() => useHealth())
    await advance(0)
    unmount()

    await advance(90000)

    expect(checkHealth).toHaveBeenCalledTimes(1)
  })

  it('should update status when health check returns different value', async () => {
    vi.useFakeTimers()
    checkHealth
      .mockResolvedValueOnce({ status: 'ok' })
      .mockResolvedValueOnce({ status: 'degraded' })

    const { result } = renderHook(() => useHealth())
    await advance(0)
    expect(result.current.status).toBe('ok')

    await advance(30000)

    expect(result.current.status).toBe('degraded')
  })

  it('should clear error when health check succeeds after failure', async () => {
    vi.useFakeTimers()
    checkHealth
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ status: 'ok' })

    const { result } = renderHook(() => useHealth())
    await advance(0)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Failed')

    await advance(30000)

    expect(result.current.status).toBe('ok')
    expect(result.current.error).toBeNull()
  })
})