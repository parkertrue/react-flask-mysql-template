import { describe, it, expect, vi } from 'vitest'
import { checkHealth } from '../healthService'
import { api } from '../../api'

vi.mock('../../api')

describe('healthService', () => {
  describe('checkHealth', () => {
    it('should call GET /health', async () => {
      const mockResponse = {
        data: {
          status: 'ok',
          timestamp: '2024-01-01T00:00:00Z'
        }
      }
      api.get.mockResolvedValue(mockResponse)

      const result = await checkHealth()

      expect(api.get).toHaveBeenCalledWith('/health')
      expect(result).toEqual(mockResponse.data)
    })

    it('should return status object', async () => {
      const mockResponse = {
        data: { status: 'ok' }
      }
      api.get.mockResolvedValue(mockResponse)

      const result = await checkHealth()

      expect(result).toHaveProperty('status')
      expect(result.status).toBe('ok')
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Health check failed')
      api.get.mockRejectedValue(error)

      await expect(checkHealth()).rejects.toThrow('Health check failed')
    })
  })
})