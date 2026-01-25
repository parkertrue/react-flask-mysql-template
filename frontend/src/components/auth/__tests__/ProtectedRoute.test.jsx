import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'
import { AuthProvider } from '../../../contexts/AuthContext'
import { storage } from '../../../utils/storage'

vi.mock('../../../utils/storage')

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const renderWithRouter = (initialRoute = '/protected') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
  }

  describe('when not authenticated', () => {
    it('should redirect to login page', () => {
      renderWithRouter()

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })

    it('should not render children', () => {
      renderWithRouter()

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('user@example.com')
    })

    it('should render children', () => {
      renderWithRouter()

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
    })

    it('should wrap children in protected-route div', () => {
      renderWithRouter()

      const protectedDiv = screen.getByText('Protected Content').parentElement
      expect(protectedDiv).toHaveClass('protected-route')
    })

    it('should render multiple children', () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>Child 1</div>
                    <div>Child 2</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })
  })
})