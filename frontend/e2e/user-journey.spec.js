import { test, expect } from '@playwright/test'
import {
  TEST_PASSWORD, addNote, login, logout, register, submitRegistration, uniqueEmail,
} from './helpers'

test.describe('Critical User Journey', () => {
  let testEmail

  test.beforeEach(() => {
    testEmail = uniqueEmail('e2e-test')
  })

  test('complete user journey: register → login → create note → logout', async ({ page }) => {
    // 1. Navigate to home page
    await page.goto('/')
    await expect(page.getByText(/Welcome to Flask \+ React \+ MySQL Template App/i)).toBeVisible()

    // 2. Register new user - click "Get Started" button (primary CTA)
    await page.getByRole('link', { name: /get started/i }).click()
    await expect(page).toHaveURL(/\/register/)
    
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
    
    // Click register button
    await page.getByRole('button', { name: /register|creating account/i }).click()
    
    // Success goes straight to login, which confirms it. If registration
    // fails, this fails and the failure screenshot shows the error.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    await expect(page.getByRole('status')).toHaveText(/registration successful/i)

    // 3. Login with newly created account
    await login(page, testEmail)
    await expect(page.getByRole('heading', { name: /my notes/i })).toBeVisible()

    // 4. Create a note
    const noteContent = `Test note created at ${new Date().toISOString()}`
    await addNote(page, noteContent)

    // 5. Verify session persistence (page refresh)
    await page.reload()
    await expect(page).toHaveURL(/\/notes/)
    await expect(page.getByText(noteContent)).toBeVisible()

    // 6. Logout, which returns to the home page
    await logout(page)

    // Verify user is logged out by checking they can't access notes
    await page.goto('/notes')
    await expect(page).toHaveURL(/\/login/)
  })

  test('cannot access protected routes without authentication', async ({ page }) => {
    // Try to access notes page directly
    await page.goto('/notes')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('nonexistent@example.com')
    await page.getByLabel(/password/i).fill('WrongPassword123')
    await page.getByRole('button', { name: /login|logging in/i }).click()

    await expect(page.getByRole('alert')).toHaveText(/invalid email or password/i)
    
    // Should still be on login page
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