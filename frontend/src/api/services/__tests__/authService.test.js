import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerUser, loginUser, logoutUser, logoutAllDevices } from '../authService'
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

    it('should handle validation errors', async () => {
      const error = {
        response: {
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid email format'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(
        registerUser('invalid-email', 'password123')
      ).rejects.toEqual(error)
    })

    it('should handle duplicate email errors', async () => {
      const error = {
        response: {
          data: {
            error: {
              code: 'EMAIL_ALREADY_REGISTERED',
              message: 'Email already registered'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(
        registerUser('existing@example.com', 'password123')
      ).rejects.toEqual(error)
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

    it('should return access token and refresh csrf', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          refresh_csrf: 'test-csrf-token'
        }
      }
      api.post.mockResolvedValue(mockResponse)

      const result = await loginUser('test@example.com', 'password123')

      expect(result).toHaveProperty('access_token')
      expect(result).toHaveProperty('refresh_csrf')
      expect(result.access_token).toBe('test-access-token')
      expect(result.refresh_csrf).toBe('test-csrf-token')
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Invalid credentials')
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'wrong-password')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should handle invalid credentials error', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'wrong-password')
      ).rejects.toEqual(error)
    })

    it('should handle network errors', async () => {
      const error = new Error('Network Error')
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'password123')
      ).rejects.toThrow('Network Error')
    })

    it('should handle rate limiting errors', async () => {
      const error = {
        response: {
          status: 429,
          data: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many login attempts'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'password123')
      ).rejects.toEqual(error)
    })
  })

  describe('logoutUser', () => {
    it('should call POST /auth/logout', async () => {
      api.post.mockResolvedValue({})

      await logoutUser()

      expect(api.post).toHaveBeenCalledWith('/auth/logout')
    })

    it('should call logout endpoint exactly once', async () => {
      api.post.mockResolvedValue({})

      await logoutUser()

      expect(api.post).toHaveBeenCalledTimes(1)
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Logout failed')
      api.post.mockRejectedValue(error)

      await expect(logoutUser()).rejects.toThrow('Logout failed')
    })

    it('should handle unauthorized errors gracefully', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'AUTH_MISSING_TOKEN',
              message: 'Authentication required'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(logoutUser()).rejects.toEqual(error)
    })

    it('should handle network errors', async () => {
      const error = new Error('Network Error')
      api.post.mockRejectedValue(error)

      await expect(logoutUser()).rejects.toThrow('Network Error')
    })
  })

  describe('logoutAllDevices', () => {
    it('should call POST /auth/logout-all', async () => {
      api.post.mockResolvedValue({})

      await logoutAllDevices()

      expect(api.post).toHaveBeenCalledWith('/auth/logout-all')
    })

    it('should call logout-all endpoint exactly once', async () => {
      api.post.mockResolvedValue({})

      await logoutAllDevices()

      expect(api.post).toHaveBeenCalledTimes(1)
    })

    it('should not pass any parameters', async () => {
      api.post.mockResolvedValue({})

      await logoutAllDevices()

      expect(api.post).toHaveBeenCalledWith('/auth/logout-all')
      expect(api.post.mock.calls[0]).toHaveLength(1)
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Logout all failed')
      api.post.mockRejectedValue(error)

      await expect(logoutAllDevices()).rejects.toThrow('Logout all failed')
    })

    it('should handle unauthorized errors', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'AUTH_MISSING_TOKEN',
              message: 'Authentication required'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(logoutAllDevices()).rejects.toEqual(error)
    })

    it('should handle token revocation errors', async () => {
      const error = {
        response: {
          status: 500,
          data: {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to revoke tokens'
            }
          }
        }
      }
      api.post.mockRejectedValue(error)

      await expect(logoutAllDevices()).rejects.toEqual(error)
    })

    it('should handle network errors', async () => {
      const error = new Error('Network Error')
      api.post.mockRejectedValue(error)

      await expect(logoutAllDevices()).rejects.toThrow('Network Error')
    })

    it('should work independently of logoutUser', async () => {
      api.post.mockResolvedValue({})

      await logoutUser()
      await logoutAllDevices()

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post).toHaveBeenNthCalledWith(1, '/auth/logout')
      expect(api.post).toHaveBeenNthCalledWith(2, '/auth/logout-all')
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete register -> login flow', async () => {
      const registerResponse = {
        data: { message: 'User created' }
      }
      const loginResponse = {
        data: {
          access_token: 'token123',
          refresh_csrf: 'csrf123'
        }
      }

      api.post
        .mockResolvedValueOnce(registerResponse)
        .mockResolvedValueOnce(loginResponse)

      await registerUser('test@example.com', 'password123')
      const loginResult = await loginUser('test@example.com', 'password123')

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(loginResult.access_token).toBe('token123')
    })

    it('should handle login -> logout flow', async () => {
      const loginResponse = {
        data: {
          access_token: 'token123',
          refresh_csrf: 'csrf123'
        }
      }

      api.post
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce({})

      await loginUser('test@example.com', 'password123')
      await logoutUser()

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post).toHaveBeenNthCalledWith(1, '/auth/login', expect.any(Object))
      expect(api.post).toHaveBeenNthCalledWith(2, '/auth/logout')
    })

    it('should handle login -> logout all flow', async () => {
      const loginResponse = {
        data: {
          access_token: 'token123',
          refresh_csrf: 'csrf123'
        }
      }

      api.post
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce({})

      await loginUser('test@example.com', 'password123')
      await logoutAllDevices()

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post).toHaveBeenNthCalledWith(1, '/auth/login', expect.any(Object))
      expect(api.post).toHaveBeenNthCalledWith(2, '/auth/logout-all')
    })

    it('should handle multiple logout attempts gracefully', async () => {
      api.post.mockResolvedValue({})

      await logoutUser()
      await logoutUser()

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post).toHaveBeenCalledWith('/auth/logout')
    })

    it('should handle logout-all after logout', async () => {
      api.post.mockResolvedValue({})

      await logoutUser()
      await logoutAllDevices()

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post).toHaveBeenNthCalledWith(1, '/auth/logout')
      expect(api.post).toHaveBeenNthCalledWith(2, '/auth/logout-all')
    })
  })

  describe('error handling edge cases', () => {
    it('should handle timeout errors', async () => {
      const error = new Error('timeout of 5000ms exceeded')
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'password123')
      ).rejects.toThrow('timeout')
    })

    it('should handle CORS errors', async () => {
      const error = new Error('Network Error')
      error.code = 'ERR_NETWORK'
      api.post.mockRejectedValue(error)

      await expect(
        loginUser('test@example.com', 'password123')
      ).rejects.toThrow('Network Error')
    })
  })

  describe('parameter validation', () => {
    it('should pass exact parameters to register', async () => {
      api.post.mockResolvedValue({ data: {} })

      await registerUser('user@test.com', 'Pass123!')

      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        email: 'user@test.com',
        password: 'Pass123!'
      })
    })

    it('should pass exact parameters to login', async () => {
      api.post.mockResolvedValue({ data: {} })

      await loginUser('user@test.com', 'Pass123!')

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'user@test.com',
        password: 'Pass123!'
      })
    })

    it('should not modify email in registerUser', async () => {
      api.post.mockResolvedValue({ data: {} })

      const email = 'Test@Example.COM'
      await registerUser(email, 'password123')

      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        email: 'Test@Example.COM',
        password: 'password123'
      })
    })

    it('should not modify password in loginUser', async () => {
      api.post.mockResolvedValue({ data: {} })

      const password = 'P@ssw0rd!123'
      await loginUser('test@example.com', password)

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'P@ssw0rd!123'
      })
    })
  })

  describe('concurrent requests', () => {
    it('should handle multiple simultaneous register calls', async () => {
      api.post.mockResolvedValue({ data: { message: 'User created' } })

      const promises = [
        registerUser('user1@test.com', 'pass1'),
        registerUser('user2@test.com', 'pass2'),
        registerUser('user3@test.com', 'pass3')
      ]

      await Promise.all(promises)

      expect(api.post).toHaveBeenCalledTimes(3)
    })

    it('should handle multiple simultaneous login calls', async () => {
      api.post.mockResolvedValue({
        data: { access_token: 'token', refresh_csrf: 'csrf' }
      })

      const promises = [
        loginUser('user1@test.com', 'pass1'),
        loginUser('user2@test.com', 'pass2')
      ]

      await Promise.all(promises)

      expect(api.post).toHaveBeenCalledTimes(2)
    })

    it('should handle multiple simultaneous logout calls', async () => {
      api.post.mockResolvedValue({})

      const promises = [
        logoutUser(),
        logoutUser(),
        logoutUser()
      ]

      await Promise.all(promises)

      expect(api.post).toHaveBeenCalledTimes(3)
    })

    it('should handle logout and logoutAll simultaneously', async () => {
      api.post.mockResolvedValue({})

      await Promise.all([
        logoutUser(),
        logoutAllDevices()
      ])

      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post).toHaveBeenCalledWith('/auth/logout')
      expect(api.post).toHaveBeenCalledWith('/auth/logout-all')
    })
  })
})