import { test, expect } from '@playwright/test'
import { createHmac, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { TEST_PASSWORD, login, uniqueEmail } from './helpers'

// The E2E backend signs tokens with SECRET_KEY from .env.test, so the test can
// mint an access token that is validly signed but already expired: exactly
// what the browser holds once the real 15-minute token lapses.
function expiredAccessToken() {
  const env = readFileSync(path.join(import.meta.dirname, '..', '..', '.env.test'), 'utf8')
  const secret = env.match(/^SECRET_KEY=(.*)$/m)[1].trim()
  const now = Math.floor(Date.now() / 1000)
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    sub: '1', type: 'access', fresh: false, jti: randomUUID(),
    iat: now - 3600, nbf: now - 3600, exp: now - 60,
  })
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

async function expireAccessToken(page) {
  await page.evaluate(token => localStorage.setItem('access_token', token), expiredAccessToken())
}

test('an expired session refreshes repeatedly, and logout revokes it', async ({ page }) => {
  const email = uniqueEmail('e2e-refresh')
  const register = await page.request.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD },
  })
  expect(register.status()).toBe(201)

  await page.goto('/login')
  await login(page, email)
  await expect(page.getByRole('heading', { name: /my notes/i })).toBeVisible()

  // Each refresh rotates the refresh token and its CSRF value. The second
  // round only succeeds if the client stored the rotated CSRF value.
  for (let round = 1; round <= 2; round++) {
    await expireAccessToken(page)
    const refreshed = page.waitForResponse('**/api/auth/refresh')
    await page.reload()

    expect((await refreshed).status(), `refresh #${round}`).toBe(200)
    await expect(page).toHaveURL(/\/notes/)
    await expect(page.getByTestId('notes-empty')).toBeVisible()
  }

  // Keep the session's credentials to replay after logout
  const csrf = await page.evaluate(() => localStorage.getItem('refresh_csrf'))
  const refreshCookie = (await page.context().cookies())
    .find(c => c.name === 'refresh_token_cookie')

  await page.getByRole('button', { name: /logout/i }).click()
  const loggedOut = page.waitForResponse('**/api/auth/logout')
  await page.getByText(/logout this device/i).click()
  expect((await loggedOut).status()).toBe(200)

  // Replaying the old refresh token must fail: logout revoked it server-side
  await page.context().addCookies([refreshCookie])
  const replay = await page.request.post('/api/auth/refresh', {
    headers: { 'X-CSRF-REFRESH-TOKEN': csrf },
  })
  expect(replay.status()).toBe(401)
})
