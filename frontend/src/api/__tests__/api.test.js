import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { api } from '../api'
import { storage } from '../../utils/storage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  window.location.href = 'http://localhost/'
})
afterAll(() => server.close())

const expired = () => HttpResponse.json(
  { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Session expired' } },
  { status: 401 }
)

// A backend that expires every access token except the latest one it issued,
// and, like flask-jwt-extended, requires the CSRF value of the current
// refresh token on refresh.
function mockBackend() {
  const state = { issued: 0, validToken: 'access-0', csrf: 'csrf-0', refreshCalls: [] }

  server.use(
    http.post('/api/auth/refresh', ({ request }) => {
      const sent = request.headers.get('X-CSRF-REFRESH-TOKEN')
      state.refreshCalls.push(sent)
      if (sent !== state.csrf) {
        return HttpResponse.json(
          { error: { code: 'AUTH_MISSING_TOKEN', message: 'Authentication required' } },
          { status: 401 }
        )
      }
      state.issued += 1
      state.validToken = `access-${state.issued}`
      state.csrf = `csrf-${state.issued}`
      return HttpResponse.json({ access_token: state.validToken, refresh_csrf: state.csrf })
    }),
    http.get('/api/notes', ({ request }) => {
      if (request.headers.get('Authorization') !== `Bearer ${state.validToken}`) {
        return expired()
      }
      return HttpResponse.json([])
    })
  )

  storage.setAccessToken('stale-token')
  storage.setRefreshCsrf('csrf-0')
  return state
}

describe('api client configuration', () => {
  it('uses the /api base URL with credentials', () => {
    expect(api.defaults.baseURL).toBe('/api')
    expect(api.defaults.withCredentials).toBe(true)
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})

describe('request headers', () => {
  function captureHeaders(method, path) {
    const captured = {}
    server.use(
      http[method](`/api${path}`, ({ request }) => {
        captured.authorization = request.headers.get('Authorization')
        captured.csrf = request.headers.get('X-CSRF-REFRESH-TOKEN')
        return HttpResponse.json({})
      })
    )
    return captured
  }

  it('attaches the stored access token', async () => {
    storage.setAccessToken('abc')
    const captured = captureHeaders('get', '/notes')

    await api.get('/notes')

    expect(captured.authorization).toBe('Bearer abc')
  })

  it('omits Authorization when logged out', async () => {
    const captured = captureHeaders('get', '/notes')

    await api.get('/notes')

    expect(captured.authorization).toBeNull()
  })

  it.each(['/auth/refresh', '/auth/logout', '/auth/logout-all'])(
    'sends the CSRF header to %s',
    async (path) => {
      storage.setRefreshCsrf('csrf-value')
      const captured = captureHeaders('post', path)

      await api.post(path)

      expect(captured.csrf).toBe('csrf-value')
    }
  )

  it('does not send the CSRF header elsewhere', async () => {
    storage.setRefreshCsrf('csrf-value')
    const captured = captureHeaders('post', '/notes')

    await api.post('/notes', { content: 'x' })

    expect(captured.csrf).toBeNull()
  })
})

describe('expired access token', () => {
  it('refreshes, stores the new tokens, and retries the request', async () => {
    const backend = mockBackend()

    const response = await api.get('/notes')

    expect(response.status).toBe(200)
    expect(storage.getAccessToken()).toBe('access-1')
    expect(storage.getRefreshCsrf()).toBe('csrf-1')
    expect(backend.refreshCalls).toEqual(['csrf-0'])
  })

  it('sends the rotated CSRF token on the next refresh', async () => {
    const backend = mockBackend()
    await api.get('/notes')

    storage.setAccessToken('stale-again')
    const response = await api.get('/notes')

    expect(response.status).toBe(200)
    expect(backend.refreshCalls).toEqual(['csrf-0', 'csrf-1'])
  })

  it('shares one refresh between concurrent requests', async () => {
    const backend = mockBackend()

    const responses = await Promise.all([api.get('/notes'), api.get('/notes')])

    expect(responses.map(r => r.status)).toEqual([200, 200])
    expect(backend.refreshCalls).toHaveLength(1)
  })

  it('logs out and redirects when the refresh fails', async () => {
    mockBackend()
    storage.setRefreshCsrf('wrong')

    await expect(api.get('/notes')).rejects.toBeTruthy()

    expect(storage.getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })
})

describe('invalid or missing token', () => {
  const rejectWith = (method, path, code) => server.use(
    http[method](`/api${path}`, () =>
      HttpResponse.json({ error: { code, message: 'x' } }, { status: 401 }))
  )

  it('logs out and redirects on an invalid token', async () => {
    storage.setAccessToken('forged')
    rejectWith('get', '/notes', 'AUTH_INVALID_TOKEN')

    await expect(api.get('/notes')).rejects.toBeTruthy()

    expect(storage.getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('leaves logout failures to the caller', async () => {
    storage.setAccessToken('token')
    rejectWith('post', '/auth/logout', 'AUTH_MISSING_TOKEN')

    await expect(api.post('/auth/logout')).rejects.toBeTruthy()

    expect(storage.getAccessToken()).toBe('token')
    expect(window.location.href).toBe('http://localhost/')
  })
})
