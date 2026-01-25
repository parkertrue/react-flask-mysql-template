import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoginPage from '../LoginPage'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'
import { loginUser } from '../../api/services/authService'

vi.mock('../../utils/storage')
vi.mock('../../api/services/authService')

describe('LoginPage', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const renderLoginPage = (initialRoute = '/login') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/notes" element={<div>Notes Page</div>} />
            <Route path="/register" element={<div>Register Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
  }

  describe('rendering', () => {
    it('should render login heading', () => {
      renderLoginPage()

      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
    })

    it('should render login form', () => {
      renderLoginPage()

      expect(screen.getByTestId('login-form')).toBeInTheDocument()
    })

    it('should render email input', () => {
      renderLoginPage()

      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toBeInTheDocument()
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
    })

    it('should render password input', () => {
      renderLoginPage()

      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
    })

    it('should render submit button', () => {
      renderLoginPage()

      const submitBtn = screen.getByRole('button', { name: /login/i })
      expect(submitBtn).toBeInTheDocument()
    })

    it('should render register link', () => {
      renderLoginPage()

      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toHaveAttribute('href', '/register')
    })
  })

  describe('form input', () => {
    it('should update email input', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'test@example.com')

      expect(emailInput).toHaveValue('test@example.com')
    })

    it('should update password input', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, 'password123')

      expect(passwordInput).toHaveValue('password123')
    })

    it('should handle multiple character inputs', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      await user.type(emailInput, 'user@test.com')
      await user.type(passwordInput, 'securePassword123!')

      expect(emailInput).toHaveValue('user@test.com')
      expect(passwordInput).toHaveValue('securePassword123!')
    })
  })

  describe('form submission', () => {
    it('should call loginUser on submit', async () => {
      loginUser.mockResolvedValue({
        access_token: 'token123',
        refresh_csrf: 'csrf123'
      })

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /login/i }))

      expect(loginUser).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('should store auth data on successful login', async () => {
      loginUser.mockResolvedValue({
        access_token: 'token123',
        refresh_csrf: 'csrf123'
      })

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(storage.setAccessToken).toHaveBeenCalledWith('token123')
        expect(storage.setRefreshCsrf).toHaveBeenCalledWith('csrf123')
        expect(storage.setEmail).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should navigate to notes page on successful login', async () => {
      loginUser.mockResolvedValue({
        access_token: 'token123',
        refresh_csrf: 'csrf123'
      })

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(screen.getByText('Notes Page')).toBeInTheDocument()
      })
    })

    it('should display error message on login failure', async () => {
      loginUser.mockRejectedValue({
        response: {
          data: {
            error: { message: 'Invalid credentials' }
          }
        }
      })

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'wrong-password')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid credentials')
      })
    })

    it('should clear previous error on new submission', async () => {
      loginUser
        .mockRejectedValueOnce({
          response: { data: { error: { message: 'First error' } } }
        })
        .mockResolvedValueOnce({
          access_token: 'token',
          refresh_csrf: 'csrf'
        })

      const user = userEvent.setup()
      renderLoginPage()

      // First failed attempt
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'wrong')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })

      // Second successful attempt
      await user.clear(screen.getByLabelText(/password/i))
      await user.type(screen.getByLabelText(/password/i), 'correct')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('should disable inputs during submission', async () => {
      loginUser.mockImplementation(() => new Promise(() => {}))

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      
      const submitBtn = screen.getByRole('button', { name: /login/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeDisabled()
        expect(screen.getByLabelText(/password/i)).toBeDisabled()
      })
    })

    it('should disable submit button during submission', async () => {
      loginUser.mockImplementation(() => new Promise(() => {}))

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      
      const submitBtn = screen.getByRole('button', { name: /login/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(submitBtn).toBeDisabled()
      })
    })

    it('should show loading text in button', async () => {
      loginUser.mockImplementation(() => new Promise(() => {}))

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      
      const submitBtn = screen.getByRole('button', { name: /login/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logging in/i })).toBeInTheDocument()
      })
    })

    it('should re-enable form after error', async () => {
      loginUser.mockRejectedValue({
        response: { data: { error: { message: 'Error' } } }
      })

      const user = userEvent.setup()
      renderLoginPage()

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /login/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).not.toBeDisabled()
        expect(screen.getByLabelText(/password/i)).not.toBeDisabled()
        expect(screen.getByRole('button', { name: /login/i })).not.toBeDisabled()
      })
    })
  })

  describe('redirect when authenticated', () => {
    it('should redirect to notes if already authenticated', () => {
      storage.getAccessToken.mockReturnValue('token')
      storage.getEmail.mockReturnValue('user@example.com')

      renderLoginPage()

      expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
      expect(screen.getByText('Notes Page')).toBeInTheDocument()
    })
  })

  describe('CSS classes', () => {
    it('should have correct page wrapper class', () => {
      const { container } = renderLoginPage()

      const page = container.querySelector('.login-page')
      expect(page).toBeInTheDocument()
    })

    it('should have auth-container class', () => {
      const { container } = renderLoginPage()

      const container_el = container.querySelector('.auth-container')
      expect(container_el).toBeInTheDocument()
    })

    it('should have auth-card class', () => {
      const { container } = renderLoginPage()

      const card = container.querySelector('.auth-card')
      expect(card).toBeInTheDocument()
    })

    it('should have correct form classes', () => {
      renderLoginPage()

      const form = screen.getByTestId('login-form')
      expect(form).toHaveClass('auth-form')
    })

    it('should have correct button classes', () => {
      renderLoginPage()

      const button = screen.getByRole('button', { name: /login/i })
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-block')
    })
  })
})