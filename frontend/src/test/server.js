import { afterAll, afterEach, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { tokens } from './fixtures'

// The happy path of every shared endpoint; a feature keeps its own handlers
// beside its tests. A test overrides the ones it cares about with
// server.use(); resetHandlers() drops the overrides.
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),
  http.post('/api/auth/register', () =>
    HttpResponse.json({ message: 'User created' }, { status: 201 })),
  http.post('/api/auth/login', () => HttpResponse.json(tokens())),
  http.post('/api/auth/refresh', () => HttpResponse.json(tokens())),
  http.post('/api/auth/logout', () => HttpResponse.json({ message: 'Logged out' })),
  http.post('/api/auth/logout-all', () =>
    HttpResponse.json({ message: 'Logged out from 1 device(s)' })),
  http.post('/api/auth/clear-cookies', () =>
    HttpResponse.json({ message: 'Cookies cleared' })),
]

/**
 * An MSW server for this test file, started before its tests and reset after
 * each one. A request no handler matches fails the test: an unmocked call is
 * a test bug, never something to skip past.
 */
export function setupMswServer(...initialHandlers) {
  const server = setupServer(...initialHandlers)
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
  return server
}
