import { describe, it, expect } from 'vitest'

describe('api client', () => {
  it('should be configured with correct baseURL', async () => {
    const { api } = await import('../api')
    expect(api.defaults.baseURL).toBe('/api')
  })

  it('should have correct default headers', async () => {
    const { api } = await import('../api')
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('should have withCredentials enabled', async () => {
    const { api } = await import('../api')
    expect(api.defaults.withCredentials).toBe(true)
  })

  it('should have request interceptor configured', async () => {
    const { api } = await import('../api')
    expect(api.interceptors.request.handlers.length).toBeGreaterThan(0)
  })

  it('should have response interceptor configured', async () => {
    const { api } = await import('../api')
    expect(api.interceptors.response.handlers.length).toBeGreaterThan(0)
  })
})