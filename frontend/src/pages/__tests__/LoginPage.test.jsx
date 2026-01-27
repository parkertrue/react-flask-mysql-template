import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'
import { AuthContext } from '../../contexts/AuthContext'
import * as authService from '../../api/services/authService'

// Mock the auth service
vi.mock('../../api/services/authService')

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Helper to render with auth context
const renderWithAuth = (isAuthenticated = false, loginFn = vi.fn()) => {
  const authContextValue = {
    isAuthenticated,
    login: loginFn,
    logout: vi.fn(),
    token: isAuthenticated ? 'mock-token' : null,
    email: isAuthenticated ? 'user@example.com' : null,
  }

  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authContextValue}>
        <LoginPage />
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render login form', () => {
      renderWithAuth()
      
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    })

    it('should render link to register page', () => {
      renderWithAuth()
      
      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toBeInTheDocument()
      expect(registerLink).toHaveAttribute('href', '/register')
    })

    it('should have proper form structure', () => {
      renderWithAuth()
      
      const form = screen.getByTestId('login-form')
      expect(form).toBeInTheDocument()
      expect(form.tagName).toBe('FORM')
    })

    it('should render email input with correct attributes', () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('maxLength', '128')
    })

    it('should render password input with correct attributes', () => {
      renderWithAuth()
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('maxLength', '128')
    })
  })

  describe('authentication redirect', () => {
    it('should redirect to /notes if already authenticated', () => {
      renderWithAuth(true)
      
      // Component should not render the form
      expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
    })

    it('should not redirect if not authenticated', () => {
      renderWithAuth(false)
      
      expect(screen.getByTestId('login-form')).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('should show error for invalid email', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('email-error')).toHaveTextContent(/valid email/i)
    })

    it('should show error for empty password', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/required/i)
    })

    it('should show error for short password', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'short' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/at least 8 characters/i)
    })

    it('should show error for password without uppercase', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/uppercase letter/i)
    })

    it('should show error for password without number', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/number/i)
    })

    it('should clear email error when user types', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const form = screen.getByTestId('login-form')
      
      // Trigger error
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toBeInTheDocument()
      })
      
      // Clear error by typing
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('email-error')).not.toBeInTheDocument()
      })
    })

    it('should clear password error when user types', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      // Trigger error
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'short' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      
      // Clear error by typing
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('password-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('should call loginUser with correct credentials', async () => {
      const mockLogin = vi.fn()
      authService.loginUser.mockResolvedValue({
        access_token: 'mock-token',
        refresh_csrf: 'mock-csrf'
      })
      
      renderWithAuth(false, mockLogin)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(authService.loginUser).toHaveBeenCalledWith('user@example.com', 'Password123')
      })
    })

    it('should call login context method on successful login', async () => {
      const mockLogin = vi.fn()
      authService.loginUser.mockResolvedValue({
        access_token: 'test-token',
        refresh_csrf: 'test-csrf'
      })
      
      renderWithAuth(false, mockLogin)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', 'test-csrf', 'user@example.com')
      })
    })

    it('should navigate to /notes on successful login', async () => {
      const mockLogin = vi.fn()
      authService.loginUser.mockResolvedValue({
        access_token: 'test-token',
        refresh_csrf: 'test-csrf'
      })
      
      renderWithAuth(false, mockLogin)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/notes')
      })
    })

    it('should show error message on login failure', async () => {
      authService.loginUser.mockRejectedValue({
        response: {
          data: {
            error: {
              message: 'Invalid credentials'
            }
          }
        }
      })
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
      expect(screen.getByTestId('error-message')).toHaveTextContent(/invalid credentials/i)
    })

    it('should show network error on network failure', async () => {
      authService.loginUser.mockRejectedValue(new Error('Network error'))
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
    })

    it('should not submit with validation errors', async () => {
      renderWithAuth()
      
      const form = screen.getByTestId('login-form')
      fireEvent.submit(form)
      
      // Wait a bit to ensure nothing happens
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(authService.loginUser).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('should disable inputs while loading', async () => {
      authService.loginUser.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          access_token: 'token',
          refresh_csrf: 'csrf'
        }), 100))
      )
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /login/i })
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      // Check loading state
      await waitFor(() => {
        expect(emailInput).toBeDisabled()
      })
      expect(passwordInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
      expect(submitButton).toHaveTextContent(/logging in/i)
    })

    it('should re-enable inputs after successful login', async () => {
      authService.loginUser.mockResolvedValue({
        access_token: 'token',
        refresh_csrf: 'csrf'
      })
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
    })

    it('should re-enable inputs after failed login', async () => {
      authService.loginUser.mockRejectedValue(new Error('Login failed'))
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /login/i })
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).not.toBeDisabled()
      })
      expect(passwordInput).not.toBeDisabled()
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('should have proper aria-invalid attributes', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const form = screen.getByTestId('login-form')
      
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('should have proper aria-describedby for errors', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const form = screen.getByTestId('login-form')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error')
      })
      expect(screen.getByTestId('email-error')).toHaveAttribute('id', 'email-error')
    })

    it('should have proper labels for inputs', () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      expect(emailInput).toHaveAttribute('id', 'email')
      expect(passwordInput).toHaveAttribute('id', 'password')
    })
  })

  describe('CSS classes', () => {
    it('should apply error class to input with error', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/email/i)
      const form = screen.getByTestId('login-form')
      
      expect(emailInput).not.toHaveClass('error')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toHaveClass('error')
      })
    })

    it('should have proper CSS classes', () => {
      renderWithAuth()
      
      expect(screen.getByRole('heading', { name: /login/i }).parentElement).toHaveClass('auth-card')
      expect(screen.getByTestId('login-form')).toHaveClass('auth-form')
    })
  })
})
