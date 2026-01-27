import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerUser, loginUser, logoutUser } from '../authService'
import { api } from '../../api'

vi.mock('../../api')

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerUser', () => {
    it('should call POST /auth/register with credentials', async () => {
      const mockResponse = {
        data: {
          message: 'User registered successfully'
        }
      }
      api.post.mockResolvedValue(mockResponse)

      const result = await registerUser('test@example.com', 'password123')

      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        email: 'test@example.com',
        password: 'password123'
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Registration failed')
      api.post.mockRejectedValue(error)

      await expect(
        registerUser('test@example.com', 'password123')
      ).rejects.toThrow('Registration failed')
    })
  })

  describe('loginUser', () => {
    it('should call POST /auth/login with credentials', async () => {
      const mockResponse = {
        data: {
          access_token: 'token123',
          refresh_csrf: 'csrf123',
          email: 'test@example.com'
        }
      }
      api.post.mockResolvedValue(mockResponse)

      const result = await loginUser('test@example.com', 'password123')

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Invalid credentials')
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'wrong-password')
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('logoutUser', () => {
    it('should call POST /auth/logout', async () => {
      api.post.mockResolvedValue({})

      await logoutUser()

      expect(api.post).toHaveBeenCalledWith('/auth/logout')
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Logout failed')
      api.post.mockRejectedValue(error)

      await expect(logoutUser()).rejects.toThrow('Logout failed')
    })
  })
})