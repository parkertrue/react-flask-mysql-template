import { test, expect } from '@playwright/test'
import {
  TEST_PASSWORD, expireAccessToken, login, logout, logoutAllDevices, noNotesYet,
  registerAndLogin, uniqueEmail,
} from './helpers'

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
    await expect(noNotesYet(page)).toBeVisible()
  }

  // Keep the session's credentials to replay after logout
  const csrf = await page.evaluate(() => localStorage.getItem('refresh_csrf'))
  const refreshCookie = (await page.context().cookies())
    .find(c => c.name === '__Secure-refresh_token')

  const loggedOut = page.waitForResponse('**/api/auth/logout')
  await logout(page)
  expect((await loggedOut).status()).toBe(200)

  // Replaying the old refresh token must fail: logout revoked it server-side
  await page.context().addCookies([refreshCookie])
  const replay = await page.request.post('/api/auth/refresh', {
    headers: { 'X-CSRF-REFRESH-TOKEN': csrf },
  })
  expect(replay.status()).toBe(401)
})

test('logout from all devices signs the other device out', async ({ page, browser }) => {
  const email = await registerAndLogin(page, 'e2e-logout-all')

  // A second device: its own browser context, so its own cookie and storage
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  try {
    await other.goto('/login')
    await login(other, email)

    await logoutAllDevices(page)

    // The other device notices at its next refresh: rejected, so it is sent
    // to the login page rather than left with a broken session
    await expireAccessToken(other)
    const refreshed = other.waitForResponse('**/api/auth/refresh')
    await other.reload()

    expect((await refreshed).status()).toBe(401)
    await expect(other).toHaveURL(/\/login/)
  } finally {
    await otherContext.close()
  }
})

test('two tabs refreshing at once both stay signed in', async ({ page, context }) => {
  // Tabs share the refresh cookie and each refresh revokes the token it
  // used, so without the Web Lock in api.js the slower tab is signed out
  await registerAndLogin(page, 'e2e-two-tabs')
  const second = await context.newPage()
  await second.goto('/notes')
  await expect(noNotesYet(second)).toBeVisible()

  // Force the order that signs a tab out: the first refresh reaches the
  // server, but its tab hears back only after the second tab has sent its
  // own, with the token the first just revoked. (Two refreshes that reach
  // the server at the same instant can both succeed, so without this the
  // test would pass by luck.) With the lock, the second tab waits, finds
  // the first tab's token, and never sends a refresh at all.
  let refreshes = 0
  let firstRefreshed
  const firstAtServer = new Promise(resolve => { firstRefreshed = resolve })
  await context.route('**/api/auth/refresh', async route => {
    if (++refreshes === 1) {
      const response = await route.fetch()
      firstRefreshed()
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.fulfill({ response })
    } else {
      await firstAtServer
      await route.fulfill({ response: await route.fetch() })
    }
  })

  // localStorage is shared too, so this expires the token in both tabs
  await expireAccessToken(page)
  await Promise.all([page.reload(), second.reload()])

  for (const tab of [page, second]) {
    await expect(noNotesYet(tab)).toBeVisible()
    await expect(tab).toHaveURL(/\/notes/)
  }
  expect(refreshes).toBe(1)

  // And the session that survived is the real one
  await page.reload()
  await expect(noNotesYet(page)).toBeVisible()
})
