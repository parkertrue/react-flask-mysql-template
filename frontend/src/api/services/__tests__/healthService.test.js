import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkHealth } from '../healthService'
import { api } from '../../api'

vi.mock('../../api')

describe('healthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkHealth', () => {
    it('should call GET /health', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
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
        data: { status: 'healthy' }
      }
      api.get.mockResolvedValue(mockResponse)

      const result = await checkHealth()

      expect(result).toHaveProperty('status')
      expect(result.status).toBe('healthy')
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Health check failed')
      api.get.mockRejectedValue(error)

      await expect(checkHealth()).rejects.toThrow('Health check failed')
    })
  })
})