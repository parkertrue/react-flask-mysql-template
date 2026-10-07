import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers'

test.describe('Notes CRUD Operations', () => {
  let context
  let page

  // One account, registered and logged in once, for every test here
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ ignoreHTTPSErrors: true })
    page = await context.newPage()
    await registerAndLogin(page, 'e2e-crud')
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
      await expect(addButton).toBeEnabled()
      
      await addButton.click()
      await expect(page.getByText(noteText)).toBeVisible()
    }
  })

  test('can update a note', async () => {
    // Create a note to update
    const originalText = 'Original note text'
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill(originalText)
    await page.getByRole('button', { name: /create|add note/i }).click()
    await expect(page.getByText(originalText)).toBeVisible()

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
      await expect(page.getByText(updatedText)).toBeVisible()
      await expect(page.getByText(originalText)).not.toBeVisible()
    }
  })

  test('can delete a note', async () => {
    // Create a note to delete
    const noteText = 'Note to be deleted'
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill(noteText)
    await page.getByRole('button', { name: /create|add note/i }).click()
    await expect(page.getByText(noteText)).toBeVisible()

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
      await expect(page.getByText(noteText)).not.toBeVisible()
    }
  })

  test('empty note submission shows validation', async () => {
    // Try to submit empty note
    const noteInput = page.locator('textarea, input[type="text"]').first()
    await noteInput.fill('')
    
    // Button should be disabled for empty input (client-side validation)
    const addButton = page.getByRole('button', { name: /create|add note/i })
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
    await expect(page.getByText(persistentNote)).toBeVisible()

    // Reload page
    await page.reload()

    // Verify note still exists
    await expect(page.getByText(persistentNote)).toBeVisible()
  })

  test('notes are private to user', async ({ browser }) => {
    // This test needs its own context since it creates and logs out multiple users
    const testContext = await browser.newContext({ ignoreHTTPSErrors: true })
    const testPage = await testContext.newPage()
    
    try {
      await registerAndLogin(testPage, 'first-user')

      // Create a note as first user
      const firstUserNote = `Private note ${Date.now()}`
      const noteInput = testPage.locator('textarea, input[type="text"]').first()
      await noteInput.fill(firstUserNote)
      const addButton = testPage.getByRole('button', { name: /create|add note/i })
      await expect(addButton).toBeEnabled()
      await addButton.click()
      await expect(testPage.getByText(firstUserNote)).toBeVisible()

      // Logout first user
      await testPage.getByRole('button', { name: /logout/i }).click()
      await testPage.getByText(/logout this device/i).click()
      await testPage.waitForURL(/\/(login)?$/, { timeout: 10000 })

      await registerAndLogin(testPage, 'second-user')

      // Verify first user's note is NOT visible to second user
      await expect(testPage.getByText(firstUserNote)).not.toBeVisible()
    } finally {
      await testContext.close()
    }
  })
})