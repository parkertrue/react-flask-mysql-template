import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'

/**
 * Custom render function that includes common providers
 */
export function renderWithProviders(ui, options = {}) {
  const {
    initialRoute = '/',
    ...renderOptions
  } = options

  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/**
 * Mock localStorage for tests
 */
export function mockLocalStorage() {
  const store = {}
  
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString()
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key])
    }
  }
}

/**
 * Create mock API error
 */
export function createMockError(message, code = 'UNKNOWN_ERROR') {
  return {
    response: {
      data: {
        error: {
          code,
          message
        }
      }
    }
  }
}

/**
 * Wait for async updates (useful for hook testing)
 */
export function waitForNextUpdate(timeout = 1000) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * Create mock notes data
 */
export function createMockNotes(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    content: `Test note ${i + 1}`,
    created_at: new Date(Date.now() - i * 1000).toISOString()
  }))
}

/**
 * Create mock auth response
 */
export function createMockAuthResponse(email = 'test@example.com') {
  return {
    access_token: 'mock-access-token',
    refresh_csrf: 'mock-refresh-csrf',
    email
  }
}