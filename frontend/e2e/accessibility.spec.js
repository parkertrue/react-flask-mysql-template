import { test, expect } from '@playwright/test'
import {
  expectNoCspViolations, expectNoViolations, memberSince, registerAndLogin,
} from './helpers'
import { APP_NAME } from '../src/appName.js'

test.describe('Accessibility', () => {
  // These tests visit every page, so anything the app does that the CSP
  // blocks fails here. A feature's own pages are checked in its spec.
  expectNoCspViolations(test)

  test.describe('a visitor', () => {
    for (const [path, title, heading] of [
      ['/', APP_NAME, `Welcome to ${APP_NAME}`],
      ['/login', `Log in | ${APP_NAME}`, 'Log in'],
      ['/register', `Register | ${APP_NAME}`, 'Register'],
      ['/no-such-page', `Page not found | ${APP_NAME}`, 'Page not found'],
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

    // Forced colors (Windows High Contrast) drop a button's background, its
    // only edge, so the stylesheet gives it a border there instead
    test('buttons keep an edge in forced-colors mode', async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' })
      await page.goto('/login')

      await expect(page.getByRole('button', { name: 'Log in' })).toHaveCSS('border-top-style', 'solid')
    })
  })

  test.describe('a signed-in user', () => {
    test.beforeEach(async ({ page }) => {
      await registerAndLogin(page, 'e2e-a11y')
    })

    test('the account page is reached from the navbar, and has no violations', async ({ page }) => {
      await page.getByRole('link', { name: /\(account\)$/ }).click()

      await expect(page).toHaveTitle(`Account | ${APP_NAME}`)
      // Focus moved to the new page's heading, which a screen reader reads
      await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeFocused()
      await expect(memberSince(page)).toBeVisible()
      await expectNoViolations(page)
    })
  })
})
