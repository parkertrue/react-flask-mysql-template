import { expect } from '@playwright/test'
import { createHmac, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

export const TEST_PASSWORD = 'SecurePass123'

// Every run registers fresh accounts, so emails must never repeat
export const uniqueEmail = (prefix) => `${prefix}-${randomUUID()}@example.com`

/** Fill in and submit the registration form, without waiting for the result */
export async function submitRegistration(page, email, password = TEST_PASSWORD) {
  await page.goto('/register')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByLabel(/confirm password/i).fill(password)
  await page.getByRole('button', { name: /register|creating account/i }).click()
}

/** Register through the UI; the redirect to /login only follows a 201 */
export async function register(page, email, password = TEST_PASSWORD) {
  await submitRegistration(page, email, password)
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
}

/** Log in from the login page and wait for the notes page */
export async function login(page, email, password = TEST_PASSWORD) {
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  const loginButton = page.getByRole('button', { name: /login|logging in/i })
  await expect(loginButton).toBeEnabled()
  await Promise.all([
    page.waitForURL(/\/notes/, { timeout: 15000 }),
    loginButton.click(),
  ])
}

/** A new account, logged in on the notes page; returns its email */
export async function registerAndLogin(page, prefix) {
  const email = uniqueEmail(prefix)
  await register(page, email)
  await login(page, email)
  return email
}

/** The note field, found by its label as a screen reader finds it */
export const noteInput = page => page.getByLabel('New note')

/** Add a note through the form and wait for it to be listed */
export async function addNote(page, text) {
  await noteInput(page).fill(text)
  await page.getByRole('button', { name: 'Add Note' }).click()
  await expect(page.getByText(text)).toBeVisible()
}

/** Log this device out from the navbar; it lands on the home page */
export async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click()
  await page.waitForURL(/\/$/)
}

/** Sign every device out from the account page, reached by the navbar's email */
export async function logoutAllDevices(page) {
  await page.getByRole('link', { name: /\(account\)$/ }).click()
  await page.getByRole('button', { name: 'Logout All Devices' }).click()
  await page.waitForURL(/\/$/)
}

/** The notes page's message when the list loaded and is empty */
export const noNotesYet = page => page.getByText(/no notes yet/i)

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
