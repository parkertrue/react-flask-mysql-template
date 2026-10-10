import { test, expect } from '@playwright/test'
import { TEST_PASSWORD, uniqueEmail } from './helpers'

test.describe('System Health Check', () => {
  test('API health endpoint is accessible', async ({ page }) => {
    // Relative, so it follows baseURL
    const response = await page.goto('/api/health')
    
    expect(response.status()).toBe(200)
    
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  test('frontend loads correctly', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.getByText(/Welcome to Flask/i)).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to register page', async ({ page }) => {
    await page.goto('/register')
    
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: /register/i })).toBeVisible()
  })

  test('registration API returns JSON through nginx', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        email: uniqueEmail('api-test'),
        password: TEST_PASSWORD
      },
    })

    expect(response.status()).toBe(201)
    expect(await response.json()).toEqual({ message: 'User created' })
  })
})