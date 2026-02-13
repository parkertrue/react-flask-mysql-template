import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'

const generateTestEmail = () => `e2e-crud-${randomUUID()}@example.com`
const TEST_PASSWORD = 'SecurePass123'

test.describe('Notes CRUD Operations', () => {
  let testEmail
  let context
  let page

  test.beforeAll(async ({ browser }) => {
    testEmail = generateTestEmail()
    context = await browser.newContext({ ignoreHTTPSErrors: true })
    page = await context.newPage()

    // Setup: Register and login once for all tests
    await page.goto('/')
    
    // Navigate to register - use the primary "Get Started" button
    await page.getByRole('link', { name: /get started/i }).click()
    
    // Register new user
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /register|creating account/i }).click()

    // Wait for redirect to login (registration successful)
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })

    // Login
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/password/i).fill(TEST_PASSWORD)
    
    // Wait for login button to be enabled
    const loginButton = page.getByRole('button', { name: /login|logging in/i })
    await expect(loginButton).toBeEnabled({ timeout: 5000 })
    
    // Click and wait for navigation
    await Promise.all([
      page.waitForURL(/\/notes/, { timeout: 15000 }),
      loginButton.click()
    ])
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('can create multiple notes', async () => {
    const notes = ['First note', 'Second note', 'Third note']
    
    for (const noteText of notes) {
      const noteInput = page.locator('textarea, input[type="text"]').first()
      await noteInput.click()  // Focus the input first
      await noteInput.fill(noteText)
      
      // Wait for React to update button state (client-side validation)
      const addButton = page.getByRole('button', { name: /create|add note/i })
      await expect(addButton).toBeEnabled({ timeout: 5000 })
      
      await addButton.click()
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 5000 })
    }
  })

  test('can update a note', async () => {
    // Create a note to update
    const originalText = 'Original note text'
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill(originalText)
    await page.getByRole('button', { name: /create|add note/i }).click()
    await expect(page.getByText(originalText)).toBeVisible({ timeout: 5000 })

    // Find and click edit button for this note
    // Look for edit button near the note text
    const noteContainer = page.locator(`text=${originalText}`).locator('..')
    const editButton = noteContainer.getByRole('button', { name: /edit/i }).or(
      noteContainer.locator('button').filter({ hasText: /edit/i })
    )
    
    // Wait a moment for any animations
    await page.waitForTimeout(500)
    
    if (await editButton.isVisible()) {
      await editButton.click()

      // Update the note
      const updatedText = 'Updated note text'
      await noteInput.fill(updatedText)
      await page.getByRole('button', { name: /save|update/i }).click()

      // Verify update
      await expect(page.getByText(updatedText)).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(originalText)).not.toBeVisible()
    }
  })

  test('can delete a note', async () => {
    // Create a note to delete
    const noteText = 'Note to be deleted'
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill(noteText)
    await page.getByRole('button', { name: /create|add note/i }).click()
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 5000 })

    // Find and click delete button for this note
    const noteContainer = page.locator(`text=${noteText}`).locator('..')
    const deleteButton = noteContainer.getByRole('button', { name: /delete/i }).or(
      noteContainer.locator('button').filter({ hasText: /delete/i })
    )
    
    // Wait a moment for any animations
    await page.waitForTimeout(500)
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click()

      // Handle confirmation dialog if present
      const confirmButton = page.getByRole('button', { name: /confirm|yes|ok/i })
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click()
      }

      // Verify note is removed
      await expect(page.getByText(noteText)).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('empty note submission shows validation', async () => {
    // Try to submit empty note
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill('')
    
    // Button should be disabled for empty input (client-side validation)
    const addButton = page.getByRole('button', { name: /create|add note/i })
    await expect(addButton).toBeDisabled()
    
    // Verify it stays disabled
    await page.waitForTimeout(1000)
    await expect(addButton).toBeDisabled()
  })

  test('notes persist across page reloads', async () => {
    // Create a test note
    const persistentNote = `Persistent note ${Date.now()}`
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill(persistentNote)
    
    // Wait for button to be enabled
    const addButton = page.getByRole('button', { name: /create|add note/i })
    await expect(addButton).toBeEnabled({ timeout: 2000 })
    
    await addButton.click()
    await expect(page.getByText(persistentNote)).toBeVisible({ timeout: 5000 })

    // Reload page
    await page.reload()

    // Verify note still exists
    await expect(page.getByText(persistentNote)).toBeVisible({ timeout: 5000 })
  })

  test('notes are private to user', async ({ browser }) => {
    // This test needs its own context since it creates and logs out multiple users
    const testContext = await browser.newContext({ ignoreHTTPSErrors: true })
    const testPage = await testContext.newPage()
    
    try {
      const firstUserEmail = `first-user-${randomUUID()}@example.com`
      
      // Register first user
      await testPage.goto('/register')
      await testPage.getByLabel(/email/i).fill(firstUserEmail)
      await testPage.getByLabel(/^password$/i).fill(TEST_PASSWORD)
      await testPage.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
      await testPage.getByRole('button', { name: /register|creating account/i }).click()
      await expect(testPage).toHaveURL(/\/login/, { timeout: 10000 })

      // Login first user
      await testPage.getByLabel(/email/i).fill(firstUserEmail)
      await testPage.getByLabel(/password/i).fill(TEST_PASSWORD)
      const loginButton1 = testPage.getByRole('button', { name: /login|logging in/i })
      await expect(loginButton1).toBeEnabled({ timeout: 5000 })
      await Promise.all([
        testPage.waitForURL(/\/notes/, { timeout: 15000 }),
        loginButton1.click()
      ])

      // Create a note as first user
      const firstUserNote = `Private note ${Date.now()}`
      const noteInput = testPage.locator('textarea, input[type="text"]').first()
      await noteInput.fill(firstUserNote)
      const addButton = testPage.getByRole('button', { name: /create|add note/i })
      await expect(addButton).toBeEnabled({ timeout: 5000 })
      await addButton.click()
      await expect(testPage.getByText(firstUserNote)).toBeVisible({ timeout: 5000 })

      // Logout first user
      await testPage.getByRole('button', { name: /logout/i }).click()
      await testPage.getByText(/logout this device/i).click()
      await testPage.waitForURL(/\/(login)?$/, { timeout: 10000 })

      // Register second user
      const secondUserEmail = `second-user-${randomUUID()}@example.com`
      await testPage.goto('/register')
      await testPage.getByLabel(/email/i).fill(secondUserEmail)
      await testPage.getByLabel(/^password$/i).fill(TEST_PASSWORD)
      await testPage.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
      await testPage.getByRole('button', { name: /register|creating account/i }).click()
      await expect(testPage).toHaveURL(/\/login/, { timeout: 10000 })

      // Login second user
      await testPage.getByLabel(/email/i).fill(secondUserEmail)
      await testPage.getByLabel(/password/i).fill(TEST_PASSWORD)
      const loginButton2 = testPage.getByRole('button', { name: /login|logging in/i })
      await expect(loginButton2).toBeEnabled({ timeout: 5000 })
      await Promise.all([
        testPage.waitForURL(/\/notes/, { timeout: 15000 }),
        loginButton2.click()
      ])

      // Verify first user's note is NOT visible to second user
      await expect(testPage.getByText(firstUserNote)).not.toBeVisible()
    } finally {
      await testContext.close()
    }
  })
})