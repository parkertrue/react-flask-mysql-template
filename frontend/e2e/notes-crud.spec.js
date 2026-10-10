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
    await addNote(page, 'Original note text')

    await page.getByRole('button', { name: /^Edit note #/ }).click()
    const field = page.getByRole('textbox', { name: /^Edit note #/ })
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('Original note text')
    await field.fill('Updated note text')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Updated note text')).toBeVisible()
    await expect(page.getByText('Original note text')).not.toBeVisible()

    // Saved by the server, not only on screen
    await page.reload()
    await expect(page.getByText('Updated note text')).toBeVisible()
  })

  test('can delete a note', async ({ page }) => {
    await addNote(page, 'Note to keep')
    await addNote(page, 'Note to be deleted')

    const row = page.getByRole('listitem').filter({ hasText: 'Note to be deleted' })
    const deleteButton = row.getByRole('button', { name: /^Delete note #/ })
    const dialog = page.getByRole('dialog', { name: 'Delete this note?' })

    // Escape keeps the note, and focus goes back to the button that asked
    await deleteButton.click()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    // Centered, not pinned to a corner by the CSS reset's margin: 0
    const box = await dialog.boundingBox()
    expect(Math.abs(box.x + box.width / 2 - page.viewportSize().width / 2)).toBeLessThan(2)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await dialog.getByRole('button', { name: 'Delete' }).click()

    // The row, not the text: the closing dialog quotes the note too
    await expect(row).toHaveCount(0)
    // Focus moved to the remaining note rather than being lost
    await expect(page.getByRole('button', { name: /^Edit note #/ })).toBeFocused()

    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText('Note to keep')).toBeVisible()
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
