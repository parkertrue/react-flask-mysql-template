import { test, expect } from '@playwright/test'
import { expectNoCspViolations, expectNoViolations, serviceUnavailable } from './helpers'

// The home page's API-status demo (src/features/health): deleted with it
test.describe('API status', () => {
  expectNoCspViolations(test)

  test('a backend that is down shows as an error, with no violations', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill(serviceUnavailable))
    await page.goto('/')

    await expect(page.getByRole('status')).toHaveText('API status: error')
    await expectNoViolations(page)
  })
})
