import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHmac, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

export const TEST_PASSWORD = 'SecurePass123'

// Every run registers fresh accounts, so emails must never repeat
export const uniqueEmail = (prefix) => `${prefix}-${randomUUID()}@example.com`

/** Fill in and submit the registration form on the page, without waiting */
export async function fillRegistration(page, email, password = TEST_PASSWORD) {
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByLabel(/confirm password/i).fill(password)
  await page.getByRole('button', { name: /register|creating account/i }).click()
}

/** Open the registration page, then fill it in and submit it */
export async function submitRegistration(page, email, password = TEST_PASSWORD) {
  await page.goto('/register')
  await fillRegistration(page, email, password)
}

/** Register through the UI; the redirect to /login only follows a 201 */
export async function register(page, email, password = TEST_PASSWORD) {
  await submitRegistration(page, email, password)
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
}

/** Log in from the login page and wait to be sent on from it */
export async function login(page, email, password = TEST_PASSWORD) {
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  const loginButton = page.getByRole('button', { name: /^log in$|logging in/i })
  await expect(loginButton).toBeEnabled()
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/login', { timeout: 15000 }),
    loginButton.click(),
  ])
}

/** A new account, logged in on the page login leads to; returns its email */
export async function registerAndLogin(page, prefix) {
  const email = uniqueEmail(prefix)
  await register(page, email)
  await login(page, email)
  return email
}

/** Log this device out from the navbar; it lands on the home page */
export async function logout(page) {
  // Exact: the account page also has "Log out all devices"
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.waitForURL(/\/$/)
}

/** Open the account page from the navbar's email link, once it has loaded */
export async function openAccount(page) {
  await page.getByRole('link', { name: /\(account\)$/ }).click()
  await expect(memberSince(page)).toBeVisible()
}

/** The account page's line once GET /api/account has answered */
export const memberSince = page => page.getByText(/^Member since /)

/** Sign every device out from the account page, reached by the navbar's email */
export async function logoutAllDevices(page) {
  await page.getByRole('link', { name: /\(account\)$/ }).click()
  await page.getByRole('button', { name: 'Log out all devices' }).click()
  await page.waitForURL(/\/$/)
}

// The E2E backend signs tokens with SECRET_KEY from .env.test, so a test can
// re-sign the page's own access token as already expired: exactly what the
// browser holds once the real 15-minute token lapses.
function signingKey() {
  const env = readFileSync(path.join(import.meta.dirname, '..', '..', '.env.test'), 'utf8')
  return env.match(/^SECRET_KEY=(.*)$/m)[1].trim()
}

/** Replace the page's access token with the same one, expired */
export async function expireAccessToken(page) {
  const token = await page.evaluate(() => localStorage.getItem('access_token'))
  const [header, payload] = token.split('.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
  const now = Math.floor(Date.now() / 1000)
  const expired = Buffer.from(JSON.stringify({
    ...claims, iat: now - 3600, nbf: now - 3600, exp: now - 60,
  })).toString('base64url')
  const signature = createHmac('sha256', signingKey())
    .update(`${header}.${expired}`).digest('base64url')
  await page.evaluate(
    t => localStorage.setItem('access_token', t), `${header}.${expired}.${signature}`)
}

// axe checks what jsdom cannot, such as color contrast, against the WCAG 2.2
// A and AA rules. Each page is checked as rendered, with any error states shown.
export async function expectNoViolations(page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  // The rule ids and the offending markup, so a failure says what to fix
  expect(violations.map(v => ({ rule: v.id, nodes: v.nodes.map(n => n.html) }))).toEqual([])
}

/**
 * Fail each test in the calling describe block if the page's CSP (nginx)
 * blocked anything: the CSP allows only the app's own files.
 */
export function expectNoCspViolations(test) {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.cspViolations = []
      document.addEventListener('securitypolicyviolation', event => {
        window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`)
      })
    })
  })

  test.afterEach(async ({ page }) => {
    expect(await page.evaluate(() => window.cspViolations)).toEqual([])
  })
}
