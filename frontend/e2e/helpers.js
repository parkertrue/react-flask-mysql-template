import { expect } from '@playwright/test'
import { randomUUID } from 'crypto'

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
