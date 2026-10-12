import { test, expect } from '@playwright/test'
import {
  fillRegistration, login, logout, memberSince, openAccount, register, submitRegistration,
  uniqueEmail,
} from './helpers'
import { APP_NAME } from '../src/appName.js'

test.describe('Critical User Journey', () => {
  let testEmail

  test.beforeEach(() => {
    testEmail = uniqueEmail('e2e-test')
  })

  test('complete user journey: register → login → account → logout', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: `Welcome to ${APP_NAME}` })).toBeVisible()

    // The home page's call to action leads to registration
    await page.getByRole('link', { name: /get started/i }).click()
    await expect(page).toHaveURL(/\/register/)
    await fillRegistration(page, testEmail)

    // Success goes straight to login, which confirms it. If registration
    // fails, this fails and the failure screenshot shows the error.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    await expect(page.getByRole('status')).toHaveText(/registration successful/i)

    await login(page, testEmail)
    await openAccount(page)
    await expect(page.getByRole('main').getByText(testEmail, { exact: true })).toBeVisible()

    // The session survives a page load
    await page.reload()
    await expect(page).toHaveURL(/\/account/)
    await expect(memberSince(page)).toBeVisible()

    // Logging out returns home, and the account page then asks to log in
    await logout(page)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login/)
  })

  test('cannot access protected routes without authentication', async ({ page }) => {
    await page.goto('/account')
    
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('nonexistent@example.com')
    await page.getByLabel(/password/i).fill('WrongPassword123')
    await page.getByRole('button', { name: /^log in$|logging in/i }).click()

    await expect(page.getByRole('alert')).toHaveText(/invalid email or password/i)
    
    await expect(page).toHaveURL(/\/login/)
  })

  test('registration with existing email shows error', async ({ page }) => {
    const existingEmail = uniqueEmail('existing')
    await register(page, existingEmail)

    // Try to register again with same email
    await submitRegistration(page, existingEmail)
    
    await expect(page.getByRole('alert')).toHaveText(/already registered/i)
    await expect(page).toHaveURL(/\/register/)
  })
})