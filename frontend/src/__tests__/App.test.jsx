import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { storage } from '../utils/storage'

vi.mock('../utils/storage')

// Mock page components with test IDs
vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home Page</div>
}))

vi.mock('../pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">Login Page</div>
}))

vi.mock('../pages/RegisterPage', () => ({
  default: () => <div data-testid="register-page">Register Page</div>
}))

vi.mock('../pages/NotesPage', () => ({
  default: () => <div data-testid="notes-page">Notes Page</div>
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  describe('routing', () => {
    it('should render home page at root path', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })

    it('should render login page at /login', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      )

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('should render register page at /register', () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <App />
        </MemoryRouter>
      )

      expect(screen.getByTestId('register-page')).toBeInTheDocument()
    })

    it('should render notes page at /notes with protected route', () => {
      storage.getAccessToken.mockReturnValue('token')
      
      render(
        <MemoryRouter initialEntries={['/notes']}>
          <App />
        </MemoryRouter>
      )

      expect(screen.getByTestId('notes-page')).toBeInTheDocument()
    })

    it('should redirect unknown paths to home', () => {
      render(
        <MemoryRouter initialEntries={['/unknown-path']}>
          <App />
        </MemoryRouter>
      )

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  describe('layout', () => {
    it('should wrap all routes in Layout component', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })
  })

  describe('AuthProvider', () => {
    it('should provide authentication context to all routes', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )

      // If AuthProvider is properly wrapping, routes should render
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })
})