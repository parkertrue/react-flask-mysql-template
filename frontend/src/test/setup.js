import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'


afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
  },
})
