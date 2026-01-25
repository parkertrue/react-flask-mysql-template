import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RegisterPage from '../RegisterPage'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'
import { registerUser } from '../../api/services/authService'

vi.mock('../../utils/storage')
vi.mock('../../api/services/authService')

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const renderRegisterPage = (initialRoute = '/register') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/notes" element={<div>Notes Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
  }

  describe('rendering', () => {
    it('should render register heading', () => {
      renderRegisterPage()

      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument()
    })

    it('should render register form', () => {
      renderRegisterPage()

      expect(screen.getByTestId('register-form')).toBeInTheDocument()
    })

    it('should render email input', () => {
      renderRegisterPage()

      const emailInput = screen.getByLabelText(/^email$/i)
      expect(emailInput).toBeInTheDocument()
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
    })

    it('should render password input', () => {
      renderRegisterPage()

      const passwordInput = screen.getByLabelText(/^password$/i)
      expect(passwordInput).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('minlength', '8')
    })

    it('should render confirm password input', () => {
      renderRegisterPage()

      const confirmInput = screen.getByLabelText(/confirm password/i)
      expect(confirmInput).toBeInTheDocument()
      expect(confirmInput).toHaveAttribute('type', 'password')
      expect(confirmInput).toHaveAttribute('required')
      expect(confirmInput).toHaveAttribute('minlength', '8')
    })

    it('should render submit button', () => {
      renderRegisterPage()

      const submitBtn = screen.getByRole('button', { name: /register/i })
      expect(submitBtn).toBeInTheDocument()
    })

    it('should render login link', () => {
      renderRegisterPage()

      expect(screen.getByText(/already have an account/i)).toBeInTheDocument()
      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toHaveAttribute('href', '/login')
    })
  })

  describe('form input', () => {
    it('should update email input', async () => {
      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      const emailInput = screen.getByLabelText(/^email$/i)
      await user.type(emailInput, 'test@example.com')

      expect(emailInput).toHaveValue('test@example.com')
    })

    it('should update password input', async () => {
      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'password123')

      expect(passwordInput).toHaveValue('password123')
    })

    it('should update confirm password input', async () => {
      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      const confirmInput = screen.getByLabelText(/confirm password/i)
      await user.type(confirmInput, 'password123')

      expect(confirmInput).toHaveValue('password123')
    })
  })

  describe('password validation', () => {
    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password456')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Passwords do not match')
      })
    })

    it('should not call registerUser when passwords mismatch', async () => {
      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'different')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })

      expect(registerUser).not.toHaveBeenCalled()
    })
  })

  describe('form submission', () => {
    it('should call registerUser on submit with matching passwords', async () => {
      registerUser.mockResolvedValue({ message: 'Success' })

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(registerUser).toHaveBeenCalledWith('test@example.com', 'password123')
      })
    })

    it('should show success message on successful registration', async () => {
      registerUser.mockResolvedValue({ message: 'Success' })

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toHaveTextContent('Registration successful! Redirecting to login...')
      })
    })

    it('should redirect to login after successful registration', async () => {
      registerUser.mockResolvedValue({ message: 'Success' })

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
      })

      // Wait for the redirect (2 second timeout)
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display error message on registration failure', async () => {
      registerUser.mockRejectedValue({
        response: {
          data: {
            error: { message: 'Email already exists' }
          }
        }
      })

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Email already exists')
      })
    })

    it('should clear error on new submission attempt', async () => {
      registerUser
        .mockRejectedValueOnce({
          response: { data: { error: { message: 'First error' } } }
        })
        .mockResolvedValueOnce({ message: 'Success' })

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      // First attempt - fails
      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })

      // Second attempt - succeeds
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('should disable inputs during submission', async () => {
      registerUser.mockImplementation(() => new Promise(() => {}))

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      
      const submitBtn = screen.getByRole('button', { name: /register/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByLabelText(/^email$/i)).toBeDisabled()
        expect(screen.getByLabelText(/^password$/i)).toBeDisabled()
        expect(screen.getByLabelText(/confirm password/i)).toBeDisabled()
      })
    })

    it('should disable submit button during submission', async () => {
      registerUser.mockImplementation(() => new Promise(() => {}))

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      
      const submitBtn = screen.getByRole('button', { name: /register/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(submitBtn).toBeDisabled()
      })
    })

    it('should show loading text in button', async () => {
      registerUser.mockImplementation(() => new Promise(() => {}))

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      
      const submitBtn = screen.getByRole('button', { name: /register/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
      })
    })

    it('should re-enable form after error', async () => {
      registerUser.mockRejectedValue({
        response: { data: { error: { message: 'Error' } } }
      })

      const user = userEvent.setup({ delay: null })
      renderRegisterPage()

      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/^email$/i)).not.toBeDisabled()
        expect(screen.getByLabelText(/^password$/i)).not.toBeDisabled()
        expect(screen.getByLabelText(/confirm password/i)).not.toBeDisabled()
        expect(screen.getByRole('button', { name: /register/i })).not.toBeDisabled()
      })
    })
  })

  describe('redirect when authenticated', () => {
    it('should redirect to notes if already authenticated', () => {
      storage.getAccessToken.mockReturnValue('token')
      storage.getEmail.mockReturnValue('user@example.com')

      renderRegisterPage()

      expect(screen.queryByTestId('register-form')).not.toBeInTheDocument()
      expect(screen.getByText('Notes Page')).toBeInTheDocument()
    })
  })

  describe('CSS classes', () => {
    it('should have correct page wrapper class', () => {
      const { container } = renderRegisterPage()

      const page = container.querySelector('.register-page')
      expect(page).toBeInTheDocument()
    })

    it('should have auth-container class', () => {
      const { container } = renderRegisterPage()

      const container_el = container.querySelector('.auth-container')
      expect(container_el).toBeInTheDocument()
    })

    it('should have auth-card class', () => {
      const { container } = renderRegisterPage()

      const card = container.querySelector('.auth-card')
      expect(card).toBeInTheDocument()
    })

    it('should have correct form classes', () => {
      renderRegisterPage()

      const form = screen.getByTestId('register-form')
      expect(form).toHaveClass('auth-form')
    })

    it('should have correct button classes', () => {
      renderRegisterPage()

      const button = screen.getByRole('button', { name: /register/i })
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-block')
    })
  })
})