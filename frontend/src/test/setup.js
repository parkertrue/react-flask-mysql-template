import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// React warns when state changes outside act(): the test asserted, or ended,
// before the component settled, which is how flaky tests start. Fail the
// test instead; await the final state (findBy*, waitFor) to fix it.
const consoleError = console.error
let actWarning = null
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
    actWarning ??= args[0].replace('%s', args[1])
  }
  consoleError(...args)
}

afterEach(() => {
  cleanup()
  localStorage.clear()

  const warning = actWarning
  actWarning = null
  if (warning) {
    throw new Error(`State updated outside act(): ${warning.split('\n')[0]}`)
  }
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
