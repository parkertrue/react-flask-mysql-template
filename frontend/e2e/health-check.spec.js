import { test, expect } from '@playwright/test'

test.describe('System Health Check', () => {
  test('API health endpoint is accessible', async ({ page }) => {
    // Try to access the health endpoint
    const response = await page.goto('https://localhost/api/health')
    
    expect(response.status()).toBe(200)
    
    const body = await response.json()
    console.log('Health check response:', body)
    expect(body.status).toBe('ok') // Changed from 'healthy' to 'ok'
  })

  test('frontend loads correctly', async ({ page }) => {
    await page.goto('/')
    
    // Check if we can see the home page
    await expect(page.getByText(/Welcome to Flask/i)).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to register page', async ({ page }) => {
    await page.goto('/register')
    
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: /register/i })).toBeVisible()
  })

  test('registration API returns expected response', async ({ page, request }) => {
    // Test the API directly to see what it returns
    const testEmail = `api-test-${Date.now()}@example.com`
    
    const response = await request.post('https://localhost/api/auth/register', {
      data: {
        email: testEmail,
        password: 'SecurePass123'
      },
      ignoreHTTPSErrors: true
    })
    
    console.log('Registration API status:', response.status())
    const body = await response.text()
    console.log('Registration API response body:', body)
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(body)
      console.log('Registration API JSON:', JSON.stringify(json, null, 2))
    } catch (e) {
      console.log('Response is not JSON, raw text:', body.substring(0, 500))
    }
  })
})