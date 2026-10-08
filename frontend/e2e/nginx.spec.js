import { test, expect } from '@playwright/test'

// What nginx itself promises (nginx/templates/default.conf.template), checked
// over the wire. Each of these has broken before without any other test
// noticing, since the app works the same either way.

const HTTP = 'http://localhost:8080'

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
    const paths = ['/', '/api/health', '/api/notes', await firstAssetPath(request)]

    for (const path of paths) {
      const headers = (await request.get(path)).headers()
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[name], `${name} on ${path}`).toMatch(value)
      }
    }
  })

  test('HTML is revalidated, hashed assets are cached for good', async ({ request }) => {
    const page = await request.get('/notes')
    const asset = await request.get(await firstAssetPath(request))

    expect(page.headers()['cache-control']).toBe('no-cache')
    expect(asset.headers()['cache-control']).toMatch(/max-age=31536000.*immutable|immutable.*max-age=31536000/)
  })

  test('plain HTTP redirects to HTTPS', async ({ request }) => {
    const response = await request.get(`${HTTP}/notes?x=1`, { maxRedirects: 0 })

    expect(response.status()).toBe(301)
    expect(response.headers()['location']).toBe('https://localhost/notes?x=1')
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

  test('an oversized body is refused in the API\'s error shape', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'a@example.com', password: 'x'.repeat(20 * 1024) },
    })

    expect(response.status()).toBe(413)
    expect((await response.json()).error.code).toBe('PAYLOAD_TOO_LARGE')
  })
})
