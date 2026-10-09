import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AuthProvider } from '../AuthProvider'
import { useAuth } from '../useAuth'
import { storage } from '../storage'
import { signIn } from '@/test/router'

const renderAuth = () =>
  renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> })

describe('AuthProvider', () => {
  it('starts signed out when nothing is stored', () => {
    const { result } = renderAuth()

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.email).toBeNull()
  })

  it('picks up a stored session, as after a page load', () => {
    signIn('stored@example.com')

    const { result } = renderAuth()

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('stored@example.com')
  })

  it('login stores the session and signs in', () => {
    const { result } = renderAuth()

    act(() => result.current.login('access', 'csrf', 'user@example.com'))

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('user@example.com')
    expect(storage.getAccessToken()).toBe('access')
    expect(storage.getRefreshCsrf()).toBe('csrf')
  })

  it('logout clears the stored session and signs out', () => {
    signIn()
    const { result } = renderAuth()

    act(() => result.current.logout())

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.email).toBeNull()
    expect(storage.getRefreshCsrf()).toBeNull()
  })

  // The api client ends a session by clearing storage when a refresh fails
  it('signs out when the session is cleared outside React', () => {
    signIn()
    const { result } = renderAuth()

    act(() => storage.clearAuth())

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('follows another tab signing in and out', () => {
    const { result } = renderAuth()
    // Another tab writes localStorage directly; this tab hears a storage event
    const otherTab = (change) => act(() => {
      change()
      window.dispatchEvent(new StorageEvent('storage'))
    })

    otherTab(() => localStorage.setItem('access_token', 'other-tab-token'))
    expect(result.current.isAuthenticated).toBe(true)

    otherTab(() => localStorage.clear())
    expect(result.current.isAuthenticated).toBe(false)
  })
})
