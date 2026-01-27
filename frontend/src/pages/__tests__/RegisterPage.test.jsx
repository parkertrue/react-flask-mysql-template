import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RegisterPage from '../RegisterPage'
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
const renderWithAuth = (isAuthenticated = false) => {
  const authContextValue = {
    isAuthenticated,
    login: vi.fn(),
    logout: vi.fn(),
    token: isAuthenticated ? 'mock-token' : null,
    email: isAuthenticated ? 'user@example.com' : null,
  }

  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authContextValue}>
        <RegisterPage />
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render registration form', () => {
      renderWithAuth()
      
      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
    })

    it('should render link to login page', () => {
      renderWithAuth()
      
      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toBeInTheDocument()
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should have proper form structure', () => {
      renderWithAuth()
      
      const form = screen.getByTestId('register-form')
      expect(form).toBeInTheDocument()
      expect(form.tagName).toBe('FORM')
    })

    it('should render all input fields with correct attributes', () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('maxLength', '128')
      
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('minLength', '8')
      expect(passwordInput).toHaveAttribute('maxLength', '128')
      
      expect(confirmInput).toHaveAttribute('type', 'password')
      expect(confirmInput).toHaveAttribute('required')
      expect(confirmInput).toHaveAttribute('minLength', '8')
      expect(confirmInput).toHaveAttribute('maxLength', '128')
    })
  })

  describe('authentication redirect', () => {
    it('should redirect to /notes if already authenticated', () => {
      renderWithAuth(true)
      
      expect(screen.queryByTestId('register-form')).not.toBeInTheDocument()
    })

    it('should not redirect if not authenticated', () => {
      renderWithAuth(false)
      
      expect(screen.getByTestId('register-form')).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('should show error for invalid email', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('email-error')).toHaveTextContent(/valid email/i)
    })

    it('should show error for empty password', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/required/i)
    })

    it('should show error for short password', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const form = screen.getByTestId('register-form')
      
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
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/uppercase letter/i)
    })

    it('should show error for password without lowercase', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'PASSWORD123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/lowercase letter/i)
    })

    it('should show error for password without number', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('password-error')).toHaveTextContent(/number/i)
    })

    it('should show error when passwords do not match', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password456' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-password-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('confirm-password-error')).toHaveTextContent(/do not match/i)
    })

    it('should clear email error when user types', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toBeInTheDocument()
      })
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('email-error')).not.toBeInTheDocument()
      })
    })

    it('should clear password error when user types', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'short' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument()
      })
      
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('password-error')).not.toBeInTheDocument()
      })
    })

    it('should clear confirm password error when user types', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Different123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-password-error')).toBeInTheDocument()
      })
      
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('confirm-password-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('should call registerUser with correct credentials', async () => {
      authService.registerUser.mockResolvedValue({})
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(authService.registerUser).toHaveBeenCalledWith('user@example.com', 'Password123')
      })
    })

    it('should show success message on successful registration', async () => {
      authService.registerUser.mockResolvedValue({})
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
      })
      expect(screen.getByTestId('success-message')).toHaveTextContent(/registration successful/i)
    })

    it('should navigate to login after successful registration', async () => {
      authService.registerUser.mockResolvedValue({})
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
      })
      
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/login')
        },
        { timeout: 3000 }
      )
    })

    it('should show error message on registration failure', async () => {
      authService.registerUser.mockRejectedValue({
        response: {
          data: {
            error: {
              message: 'Email already registered'
            }
          }
        }
      })
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
      expect(screen.getByTestId('error-message')).toHaveTextContent(/email already registered/i)
    })

    it('should show network error on network failure', async () => {
      authService.registerUser.mockRejectedValue(new Error('Network error'))
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
    })

    it('should not submit with validation errors', async () => {
      renderWithAuth()
      
      const form = screen.getByTestId('register-form')
      fireEvent.submit(form)
      
      // Wait a bit to ensure nothing happens
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(authService.registerUser).not.toHaveBeenCalled()
    })

    it('should not submit when passwords do not match', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Different123' } })
      fireEvent.submit(form)
      
      // Wait a bit to ensure nothing happens
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(authService.registerUser).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('should disable inputs while loading', async () => {
      authService.registerUser.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({}), 100))
      )
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /register/i })
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toBeDisabled()
      })
      expect(passwordInput).toBeDisabled()
      expect(confirmInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
      expect(submitButton).toHaveTextContent(/creating account/i)
    })

    it('should re-enable inputs after failed registration', async () => {
      authService.registerUser.mockRejectedValue(new Error('Registration failed'))
      
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /register/i })
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Password123' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
      
      expect(emailInput).not.toBeDisabled()
      expect(passwordInput).not.toBeDisabled()
      expect(confirmInput).not.toBeDisabled()
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('should have proper aria-invalid attributes', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const form = screen.getByTestId('register-form')
      
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('should have proper aria-describedby for errors', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const form = screen.getByTestId('register-form')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error')
      })
      expect(screen.getByTestId('email-error')).toHaveAttribute('id', 'email-error')
    })

    it('should have proper labels for all inputs', () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      
      expect(emailInput).toHaveAttribute('id', 'email')
      expect(passwordInput).toHaveAttribute('id', 'password')
      expect(confirmInput).toHaveAttribute('id', 'confirmPassword')
    })
  })

  describe('CSS classes', () => {
    it('should apply error class to inputs with errors', async () => {
      renderWithAuth()
      
      const emailInput = screen.getByLabelText(/^email$/i)
      const form = screen.getByTestId('register-form')
      
      expect(emailInput).not.toHaveClass('error')
      
      fireEvent.change(emailInput, { target: { value: 'invalid' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(emailInput).toHaveClass('error')
      })
    })

    it('should have proper CSS classes', () => {
      renderWithAuth()
      
      expect(screen.getByRole('heading', { name: /register/i }).parentElement).toHaveClass('auth-card')
      expect(screen.getByTestId('register-form')).toHaveClass('auth-form')
    })
  })
})
