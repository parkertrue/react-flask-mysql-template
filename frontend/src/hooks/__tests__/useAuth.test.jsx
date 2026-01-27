import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from '../useAuth'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'

vi.mock('../../utils/storage')

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

  it('should return auth context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current).toHaveProperty('isAuthenticated')
    expect(result.current).toHaveProperty('token')
    expect(result.current).toHaveProperty('email')
    expect(result.current).toHaveProperty('login')
    expect(result.current).toHaveProperty('logout')
  })

  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within AuthProvider')

    consoleSpy.mockRestore()
  })

  it('should provide authenticated state', () => {
    storage.getAccessToken.mockReturnValue('token')
    storage.getEmail.mockReturnValue('user@example.com')

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('user@example.com')
  })

  it('should provide unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.token).toBeNull()
    expect(result.current.email).toBeNull()
  })
})