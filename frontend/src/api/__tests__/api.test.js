import { describe, it, expect, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { api } from '../api'
import { storage } from '../../utils/storage'
import { errorBody, notesPage, tokens } from '../../test/fixtures'
import { setupMswServer } from '../../test/server'

// No default handlers: each test mocks exactly the endpoints it expects
const server = setupMswServer()

afterEach(() => {
  window.location.href = 'http://localhost/'
})

const expired = () => HttpResponse.json(errorBody('AUTH_TOKEN_EXPIRED'), { status: 401 })

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
        return HttpResponse.json(errorBody('AUTH_MISSING_TOKEN'), { status: 401 })
      }
      state.issued += 1
      state.validToken = `access-${state.issued}`
      state.csrf = `csrf-${state.issued}`
      return HttpResponse.json(tokens(state.validToken, state.csrf))
    }),
    http.get('/api/notes', ({ request }) => {
      if (request.headers.get('Authorization') !== `Bearer ${state.validToken}`) {
        return expired()
      }
      return HttpResponse.json(notesPage())
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

  it('logs out and redirects when the refresh is rejected', async () => {
    mockBackend()
    storage.setRefreshCsrf('wrong')

    await expect(api.get('/notes')).rejects.toMatchObject({ response: { status: 401 } })

    expect(storage.getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it.each([
    ['rate limited', 429, 'RATE_LIMITED'],
    ['unavailable', 503, 'SERVICE_UNAVAILABLE'],
  ])('keeps the session when the refresh is %s', async (_, status, code) => {
    mockBackend()
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json(errorBody(code), { status }))
    )

    const error = await api.get('/notes').catch(e => e)

    expect(error.response.data.error.code).toBe(code)
    expect(storage.getAccessToken()).toBe('stale-token')
    expect(storage.getRefreshCsrf()).toBe('csrf-0')
    expect(window.location.href).toBe('http://localhost/')
  })

  it('keeps the session when the refresh cannot reach the server', async () => {
    mockBackend()
    server.use(http.post('/api/auth/refresh', () => HttpResponse.error()))

    await expect(api.get('/notes')).rejects.toMatchObject({ code: 'ERR_NETWORK' })

    expect(storage.getAccessToken()).toBe('stale-token')
    expect(window.location.href).toBe('http://localhost/')
  })

  it('retries the refresh on the next request after a temporary failure', async () => {
    const backend = mockBackend()
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json(errorBody('RATE_LIMITED'), { status: 429 }),
      { once: true })
    )
    await api.get('/notes').catch(() => {})

    const response = await api.get('/notes')

    expect(response.status).toBe(200)
    expect(backend.refreshCalls).toEqual(['csrf-0'])
  })
})

describe('refreshing across tabs', () => {
  // jsdom has no Web Locks; stand in for the browser's
  function stubLocks(request) {
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })
  }
  afterEach(() => {
    delete navigator.locks
  })

  it('refreshes inside the shared lock', async () => {
    const backend = mockBackend()
    const request = vi.fn((name, callback) => callback())
    stubLocks(request)

    const response = await api.get('/notes')

    expect(response.status).toBe(200)
    expect(request).toHaveBeenCalledWith('auth-refresh', expect.any(Function))
    expect(backend.refreshCalls).toEqual(['csrf-0'])
  })

  it('uses the token another tab stored while this one waited', async () => {
    const backend = mockBackend()
    // The other tab held the lock, refreshed, and stored its new token
    stubLocks((name, callback) => {
      storage.setAccessToken(backend.validToken)
      return callback()
    })

    const response = await api.get('/notes')

    expect(response.status).toBe(200)
    expect(backend.refreshCalls).toEqual([])
  })
})

describe('invalid or missing token', () => {
  const rejectWith = (method, path, code) => server.use(
    http[method](`/api${path}`, () =>
      HttpResponse.json(errorBody(code), { status: 401 }))
  )

  it('logs out and redirects on an invalid token', async () => {
    storage.setAccessToken('forged')
    rejectWith('get', '/notes', 'AUTH_INVALID_TOKEN')

    await expect(api.get('/notes')).rejects.toMatchObject({ response: { status: 401 } })

    expect(storage.getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('leaves logout failures to the caller', async () => {
    storage.setAccessToken('token')
    rejectWith('post', '/auth/logout', 'AUTH_MISSING_TOKEN')

    await expect(api.post('/auth/logout')).rejects.toMatchObject({ response: { status: 401 } })

    expect(storage.getAccessToken()).toBe('token')
    expect(window.location.href).toBe('http://localhost/')
  })
})
