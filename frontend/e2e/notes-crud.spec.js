import { test, expect } from '@playwright/test'
import { addNote, logout, noNotesYet, noteInput, registerAndLogin } from './helpers'

test.describe('Notes CRUD Operations', () => {
  // A fresh account and page per test, so each one runs (and retries) alone
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, 'e2e-crud')
  })

  test('can create multiple notes', async ({ page }) => {
    for (const noteText of ['First note', 'Second note', 'Third note']) {
      await addNote(page, noteText)
    }
    await expect(page.getByRole('listitem')).toHaveCount(3)
  })

  test('can update a note', async ({ page }) => {
    // Create a note to update
    const originalText = 'Original note text'
    const noteInputField = noteInput(page)
    await addNote(page, originalText)

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
      await noteInputField.fill(updatedText)
      await page.getByRole('button', { name: /save|update/i }).click()

      // Verify update
      await expect(page.getByText(updatedText)).toBeVisible()
      await expect(page.getByText(originalText)).not.toBeVisible()
    }
  })

  test('can delete a note', async ({ page }) => {
    // Create a note to delete
    const noteText = 'Note to be deleted'
    await addNote(page, noteText)

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

  test('empty note submission shows validation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Note' }).click()

    // Explained on the field, which gets focus so a screen reader reads it
    await expect(noteInput(page)).toHaveAccessibleDescription('Note content is required')
    await expect(noteInput(page)).toBeFocused()
  })

  test('notes persist across page reloads', async ({ page }) => {
    const persistentNote = `Persistent note ${Date.now()}`
    await addNote(page, persistentNote)

    await page.reload()

    await expect(page.getByText(persistentNote)).toBeVisible()
  })

  test('notes are private to user', async ({ page }) => {
    const firstUserNote = `Private note ${Date.now()}`
    await addNote(page, firstUserNote)

    await logout(page)
    await registerAndLogin(page, 'second-user')

    // The second user's list has loaded, and the first user's note is not in it
    await expect(noNotesYet(page)).toBeVisible()
    await expect(page.getByText(firstUserNote)).not.toBeVisible()
  })

  test('older notes load a page at a time', async ({ page }) => {
    // 21 notes, one more than a page, created through the API for speed
    const token = await page.evaluate(() => localStorage.getItem('access_token'))
    for (let i = 1; i <= 21; i++) {
      const response = await page.request.post('/api/notes', {
        data: { content: `Note number ${i}` },
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(response.status()).toBe(201)
    }

    await page.reload()

    // Newest first: the oldest note is on the second page
    await expect(page.getByRole('listitem')).toHaveCount(20)
    await expect(page.getByText('Note number 21', { exact: true })).toBeVisible()
    await expect(page.getByText('Note number 1', { exact: true })).not.toBeVisible()

    await page.getByRole('button', { name: 'Load more' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(21)
    await expect(page.getByText('Note number 1', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Load more' })).not.toBeVisible()
  })
})
