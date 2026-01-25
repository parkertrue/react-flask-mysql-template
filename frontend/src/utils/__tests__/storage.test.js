import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../storage'

describe('storage utility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Access Token', () => {
    it('should store and retrieve access token', () => {
      const token = 'test-access-token'
      storage.setAccessToken(token)
      expect(storage.getAccessToken()).toBe(token)
    })

    it('should remove access token when set to null', () => {
      storage.setAccessToken('test-token')
      storage.setAccessToken(null)
      expect(storage.getAccessToken()).toBeNull()
    })

    it('should remove access token when set to undefined', () => {
      storage.setAccessToken('test-token')
      storage.setAccessToken(undefined)
      expect(storage.getAccessToken()).toBeNull()
    })
  })

  describe('CSRF Token', () => {
    it('should store and retrieve CSRF token', () => {
      const csrf = 'test-csrf-token'
      storage.setRefreshCsrf(csrf)
      expect(storage.getRefreshCsrf()).toBe(csrf)
    })

    it('should remove CSRF token when set to null', () => {
      storage.setRefreshCsrf('test-csrf')
      storage.setRefreshCsrf(null)
      expect(storage.getRefreshCsrf()).toBeNull()
    })
  })

  describe('Email', () => {
    it('should store and retrieve email', () => {
      const email = 'test@example.com'
      storage.setEmail(email)
      expect(storage.getEmail()).toBe(email)
    })

    it('should remove email when set to null', () => {
      storage.setEmail('test@example.com')
      storage.setEmail(null)
      expect(storage.getEmail()).toBeNull()
    })
  })

  describe('clearAuth', () => {
    it('should clear all auth data', () => {
      storage.setAccessToken('token')
      storage.setRefreshCsrf('csrf')
      storage.setEmail('test@example.com')

      storage.clearAuth()

      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshCsrf()).toBeNull()
      expect(storage.getEmail()).toBeNull()
    })

    it('should not affect other localStorage items', () => {
      localStorage.setItem('other-key', 'other-value')
      storage.setAccessToken('token')

      storage.clearAuth()

      expect(localStorage.getItem('other-key')).toBe('other-value')
    })
  })
})