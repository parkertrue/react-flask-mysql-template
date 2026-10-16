import { describe, it, expect, vi } from 'vitest'
import {
  registerUser, loginUser, logoutUser, logoutAllDevices, clearAuthCookies, deleteAccount,
} from '../authService'
import { api } from '@/api/api'
import { tokens } from '@/test/fixtures'

vi.mock('@/api/api')

// Thin wrappers over the api client: each must hit the right endpoint with
// the right body, and hand back what callers use. Interceptors, refresh and
// CSRF headers are api.test.js's job.
describe('authService', () => {
  it.each([
    ['registerUser', () => registerUser('a@example.com', 'Password123', 1),
      '/auth/register', { email: 'a@example.com', password: 'Password123', terms_version: 1 }],
    ['loginUser', () => loginUser('a@example.com', 'Password123'),
      '/auth/login', { email: 'a@example.com', password: 'Password123' }],
    ['logoutUser', () => logoutUser(), '/auth/logout', undefined],
    ['logoutAllDevices', () => logoutAllDevices(), '/auth/logout-all', undefined],
    ['deleteAccount', () => deleteAccount('Password123'), '/account/delete', { password: 'Password123' }],
    // A JSON body, so another site cannot send it without a CORS preflight
    ['clearAuthCookies', () => clearAuthCookies(), '/auth/clear-cookies', {}],
  ])('%s posts to the right endpoint', async (_, call, path, body) => {
    api.post.mockResolvedValue({ data: {} })

    await call()

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith(path, ...(body === undefined ? [] : [body]))
  })

  it('loginUser returns the tokens the backend issued', async () => {
    api.post.mockResolvedValue({ data: tokens('access', 'csrf') })

    expect(await loginUser('a@example.com', 'Password123')).toEqual(tokens('access', 'csrf'))
  })

  it('registerUser returns the backend\'s confirmation', async () => {
    api.post.mockResolvedValue({ data: { message: 'User created' } })

    expect(await registerUser('a@example.com', 'Password123')).toEqual({ message: 'User created' })
  })

  it.each(Object.entries({
    registerUser, loginUser, logoutUser, logoutAllDevices, deleteAccount,
  }))(
    '%s passes failures on to the caller untouched',
    async (_, fn) => {
      const error = new Error('Request failed')
      api.post.mockRejectedValue(error)

      await expect(fn('a@example.com', 'Password123')).rejects.toBe(error)
    }
  )

  // Its callers are already ending the session, with nothing left to try
  it('clearAuthCookies swallows a failure', async () => {
    api.post.mockRejectedValue(new Error('Request failed'))

    await expect(clearAuthCookies()).resolves.toBeUndefined()
  })
})
