import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test, expect } from '@playwright/test'

// What nginx itself promises (nginx/templates/default.conf.template), checked
// over the wire. The app works the same without any of these, so only this
// file notices one breaking.

const HTTP = 'http://localhost:8080'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')

// Runs docker compose against the test stack Playwright brought up, and
// returns what it printed
function testStack(...args) {
  return execFileSync('docker', [
    'compose', '--env-file', '.env.test', '-f', 'docker-compose.test.yml', '--profile', 'e2e', ...args,
  ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

// Whether the backend answers its health check from inside its own container,
// bypassing nginx
function backendServes() {
  try {
    testStack('exec', '-T', 'backend', 'python', '-c',
      "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=1)")
    return true
  } catch {
    return false
  }
}

const SECURITY_HEADERS = {
  'strict-transport-security': /max-age=\d+/,
  'x-frame-options': /^DENY$/,
  'x-content-type-options': /^nosniff$/,
  'referrer-policy': /^strict-origin-when-cross-origin$/,
  'content-security-policy': /frame-ancestors 'none'/,
}

async function firstAssetPath(request) {
  const html = await (await request.get('/')).text()
  return html.match(/\/assets\/[^"']+\.js/)[0]
}

test.describe('nginx', () => {
  test('every kind of response carries the security headers', async ({ request }) => {
    const paths = ['/', '/api/health', '/api/account', '/favicon.ico', await firstAssetPath(request)]

    for (const path of paths) {
      const headers = (await request.get(path)).headers()
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[name], `${name} on ${path}`).toMatch(value)
      }
    }
  })

  test('HTML is revalidated, hashed assets are cached for good', async ({ request }) => {
    const page = await request.get('/account')
    const asset = await request.get(await firstAssetPath(request))

    expect(page.headers()['cache-control']).toBe('no-cache')
    // Exact: nginx's expires would add a second Cache-Control header
    expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  test('the bundled libraries\' license notices are served as text', async ({ request }) => {
    // Written by the build (vite.config.js); without it the SPA fallback
    // would answer this path with index.html
    const response = await request.get('/third-party-licenses.txt')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/plain')
    expect(await response.text()).toContain('## react - ')
  })

  test('API responses are never stored', async ({ request }) => {
    // Set by Flask; nginx must pass it through untouched
    for (const path of ['/api/health', '/api/account']) {
      const response = await request.get(path)
      expect(response.headers()['cache-control'], path).toBe('no-store')
    }
  })

  test('plain HTTP redirects to HTTPS', async ({ request }) => {
    const response = await request.get(`${HTTP}/account?x=1`, { maxRedirects: 0 })

    expect(response.status()).toBe(301)
    expect(response.headers()['location']).toBe('https://localhost/account?x=1')
  })

  test('a request for another host gets no answer', async ({ request }) => {
    // The catch-all server: a bare IP, or any Host but the configured one
    await expect(request.get('http://127.0.0.1:8080/')).rejects.toThrow()
    await expect(request.get('https://127.0.0.1:8443/')).rejects.toThrow()
  })

  test('API paths are proxied whatever their extension', async ({ request }) => {
    // Not served from disk: a static-file rule must never outrank /api
    const response = await request.get('/api/avatar.png')

    expect(response.status()).toBe(404)
    expect(await response.json()).toEqual(
      { error: { code: 'NOT_FOUND', message: 'Resource not found' } })
  })

  test('a burst past the rate limit is refused in the API\'s error shape', async ({ request }) => {
    // 30 r/s with a burst of 20 (nginx/Dockerfile): 60 at once overflows it
    const responses = await Promise.all(
      Array.from({ length: 60 }, () => request.get('/api/account')))
    const limited = responses.filter(response => response.status() === 429)

    // The first requests reach Flask, which refuses them for want of a token
    expect(new Set(responses.map(response => response.status()))).toEqual(new Set([401, 429]))
    for (const response of limited) {
      expect(await response.json()).toEqual({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
      })
    }

    // Let the bucket refill, so the tests after this one are not limited
    await expect.poll(async () => (await request.get('/api/account')).status()).toBe(401)
  })

  test('an oversized body is refused in the API\'s error shape', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'a@example.com', password: 'x'.repeat(20 * 1024) },
    })

    expect(response.status()).toBe(413)
    expect((await response.json()).error.code).toBe('PAYLOAD_TOO_LARGE')
    // nginx answers this itself, from a location of its own
    expect(response.headers()['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'")
  })

  test('the app\'s icon is served, and /favicon.ico is not the page', async ({ request }) => {
    const icon = await request.get('/favicon.svg')
    const ico = await request.get('/favicon.ico')

    expect(icon.status()).toBe(200)
    expect(icon.headers()['content-type']).toBe('image/svg+xml')
    // Without its own location, the SPA fallback would answer with index.html
    expect(ico.status()).toBe(404)
    expect(await ico.text()).not.toContain('<div id="root">')
  })

  test('a page whose path only starts with "api" is the app', async ({ request }) => {
    const response = await request.get('/apidocs')

    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('<div id="root">')
  })
})

test.describe('nginx while the backend is away', () => {
  test.describe.configure({ timeout: 180_000 })

  // Whatever a test leaves behind, the next spec finds the backend running
  test.afterAll(() => testStack('up', '-d', '--wait', '--no-deps', 'backend'))

  test('a stopped backend answers at once, in the API\'s error shape', async ({ request }) => {
    testStack('stop', 'backend')

    // nginx keeps the stopped container's address (Docker's DNS answers a
    // stopped name with a server failure, not "not found"), so each request
    // waits out proxy_connect_timeout and gets a 504. Now and then one fails
    // sooner as unreachable, a 502 from the same error page: poll for the 504.
    const durations = []
    let last
    await expect.poll(async () => {
      const started = Date.now()
      last = await request.get('/api/health')
      durations.push(Date.now() - started)
      return last.status()
    }, { intervals: [500], timeout: 30_000 }).toBe(504)

    // The 2s connect timeout (proxy_params.conf), not a long hang
    expect(Math.max(...durations)).toBeLessThan(3000)
    expect(last.headers()['content-type']).toBe('application/json')
    expect(await last.json()).toEqual(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
  })

  test('a replaced backend is reached as soon as it serves', async ({ request }) => {
    // From a running backend that nginx reaches, as before a deploy
    testStack('up', '-d', '--wait', '--no-deps', 'backend')
    await expect.poll(async () => (await request.get('/api/health')).status(),
      { intervals: [200], timeout: 30_000 }).toBe(200)

    // A deploy's swap: while no backend container exists, nginx's lookup of
    // its name gets "not found", and nginx keeps that answer for the
    // resolver's valid= time
    // Counted rather than read --since: the host's and Docker's clocks differ
    const notFound = () => testStack('logs', 'nginx').split('Host not found').length - 1
    const before = notFound()
    testStack('rm', '--stop', '--force', 'backend')
    // Usually within seconds, but when a lookup mid-stop got a server failure
    // instead, nginx waits about 40s before it asks again
    await expect.poll(notFound, { intervals: [200], timeout: 60_000 }).toBeGreaterThan(before)

    testStack('up', '-d', '--no-deps', 'backend')
    await expect.poll(backendServes, { intervals: [200], timeout: 60_000 }).toBe(true)

    // valid=2s (nginx.conf): within moments, not the seconds a longer cache
    // of that "not found" would keep a healthy backend unreachable
    const started = Date.now()
    await expect.poll(async () => (await request.get('/api/health')).status(),
      { intervals: [200], timeout: 30_000 }).toBe(200)
    expect(Date.now() - started).toBeLessThan(3000)
  })
})
