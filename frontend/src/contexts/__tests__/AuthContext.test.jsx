import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, AuthContext } from '../AuthContext'
import { storage } from '../../utils/storage'
import { useContext } from 'react'

vi.mock('../../utils/storage')

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

  describe('initialization', () => {
    it('should initialize with no authentication', () => {
      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.token).toBeNull()
      expect(result.current.email).toBeNull()
    })

    it('should initialize with stored token', () => {
      storage.getAccessToken.mockReturnValue('stored-token')
      storage.getRefreshCsrf.mockReturnValue('stored-csrf')
      storage.getEmail.mockReturnValue('stored@example.com')

      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.token).toBe('stored-token')
      expect(result.current.email).toBe('stored@example.com')
    })
  })

  describe('login', () => {
    it('should update state and storage on login', () => {
      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      act(() => {
        result.current.login('new-token', 'new-csrf', 'user@example.com')
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.token).toBe('new-token')
      expect(result.current.email).toBe('user@example.com')

      expect(storage.setAccessToken).toHaveBeenCalledWith('new-token')
      expect(storage.setRefreshCsrf).toHaveBeenCalledWith('new-csrf')
      expect(storage.setEmail).toHaveBeenCalledWith('user@example.com')
    })

    it('should allow login when already authenticated', () => {
      storage.getAccessToken.mockReturnValue('old-token')
      
      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      act(() => {
        result.current.login('new-token', 'new-csrf', 'new@example.com')
      })

      expect(result.current.token).toBe('new-token')
      expect(result.current.email).toBe('new@example.com')
    })
  })

  describe('logout', () => {
    it('should clear state and storage on logout', () => {
      storage.getAccessToken.mockReturnValue('token')
      storage.getRefreshCsrf.mockReturnValue('csrf')
      storage.getEmail.mockReturnValue('user@example.com')

      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.token).toBeNull()
      expect(result.current.email).toBeNull()

      expect(storage.clearAuth).toHaveBeenCalled()
    })

    it('should work when not authenticated', () => {
      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(storage.clearAuth).toHaveBeenCalled()
    })
  })

  describe('isAuthenticated', () => {
    it('should be true when token exists', () => {
      storage.getAccessToken.mockReturnValue('token')

      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should be false when token is null', () => {
      storage.getAccessToken.mockReturnValue(null)

      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should update when token changes', () => {
      storage.getAccessToken.mockReturnValue(null)

      const { result } = renderHook(() => useContext(AuthContext), { wrapper })

      expect(result.current.isAuthenticated).toBe(false)

      act(() => {
        result.current.login('token', 'csrf', 'user@example.com')
      })

      expect(result.current.isAuthenticated).toBe(true)
    })
  })
})