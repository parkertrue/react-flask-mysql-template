import { describe, it, expect } from 'vitest'
import { getErrorMessage } from '../errors'

describe('getErrorMessage', () => {
  it('should return network error when no response', () => {
    const err = { message: 'Network Error' }
    expect(getErrorMessage(err)).toBe('Network error')
  })

  it('should return error message from response', () => {
    const err = {
      response: {
        data: {
          error: {
            message: 'Invalid credentials'
          }
        }
      }
    }
    expect(getErrorMessage(err)).toBe('Invalid credentials')
  })

  it('should return default message when no error object in response', () => {
    const err = {
      response: {
        data: {}
      }
    }
    expect(getErrorMessage(err)).toBe('Unknown error')
  })

  it('should return default message when error has no message', () => {
    const err = {
      response: {
        data: {
          error: {
            code: 'SOME_ERROR'
          }
        }
      }
    }
    expect(getErrorMessage(err)).toBe('Request failed')
  })

  it('should handle undefined response data', () => {
    const err = {
      response: {}
    }
    expect(getErrorMessage(err)).toBe('Unknown error')
  })
})