import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { addNote, registerAndLogin } from './helpers'

// axe checks what jsdom cannot, such as color contrast, against the WCAG 2.2
// A and AA rules. Each page is checked as rendered, with any error states shown.
async function expectNoViolations(page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  // The rule ids and the offending markup, so a failure says what to fix
  expect(violations.map(v => ({ rule: v.id, nodes: v.nodes.map(n => n.html) }))).toEqual([])
}

test.describe('Accessibility', () => {
  test.describe('a visitor', () => {
    for (const [path, title, heading] of [
      ['/', 'React + Flask Template', /welcome/i],
      ['/login', 'Login | React + Flask Template', 'Login'],
      ['/register', 'Register | React + Flask Template', 'Register'],
      ['/no-such-page', 'Page not found | React + Flask Template', 'Page not found'],
    ]) {
      test(`${path} has a title, a heading and no violations`, async ({ page }) => {
        await page.goto(path)

        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
        await expect(page).toHaveTitle(title)
        await expectNoViolations(page)
      })
    }

    test('form errors are announced and pass', async ({ page }) => {
      await page.goto('/register')
      await page.getByRole('button', { name: 'Register' }).click()

      await expect(page.getByLabel('Email')).toBeFocused()
      await expectNoViolations(page)
    })
  })

  test.describe('a signed-in user', () => {
    test.beforeEach(async ({ page }) => {
      await registerAndLogin(page, 'e2e-a11y')
    })

    test('the notes page has no violations', async ({ page }) => {
      await addNote(page, 'A note to check')

      await expect(page).toHaveTitle('My Notes | React + Flask Template')
      await expectNoViolations(page)
    })

    test('the account page is reached from the navbar, and has no violations', async ({ page }) => {
      await page.getByRole('link', { name: /\(account\)$/ }).click()

      await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
      await expect(page).toHaveTitle('Account | React + Flask Template')
      // Focus moved to the new page's content, where a screen reader starts
      await expect(page.getByRole('main')).toBeFocused()
      await expectNoViolations(page)
    })
  })
})
