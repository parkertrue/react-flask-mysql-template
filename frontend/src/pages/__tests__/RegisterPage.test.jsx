import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterPage from '../RegisterPage'
import { AuthContext } from '../../contexts/AuthContext'
import { registerUser } from '../../api/services/authService'
import { errorBody } from '../../test/fixtures'

vi.mock('../../api/services/authService')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderPage({ isAuthenticated = false } = {}) {
  const auth = { isAuthenticated, login: vi.fn(), logout: vi.fn() }
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/notes" element={<p>Notes page</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const field = {
  email: () => screen.getByLabelText(/^email$/i),
  password: () => screen.getByLabelText(/^password$/i),
  confirm: () => screen.getByLabelText(/confirm password/i),
}

function fill({ email = 'user@example.com', password = 'Password123', confirm = password } = {}) {
  fireEvent.change(field.email(), { target: { value: email } })
  fireEvent.change(field.password(), { target: { value: password } })
  fireEvent.change(field.confirm(), { target: { value: confirm } })
}

const submit = () => fireEvent.submit(screen.getByTestId('register-form'))

describe('RegisterPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the form, with a way to the login page', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument()
    expect(field.email()).toHaveAttribute('type', 'email')
    expect(field.password()).toHaveAttribute('type', 'password')
    expect(field.confirm()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login')
  })

  it('sends a signed-in user to their notes', () => {
    renderPage({ isAuthenticated: true })

    expect(screen.getByText('Notes page')).toBeInTheDocument()
  })

  describe('validation', () => {
    // One example per field: the rules themselves are covered in validation.test.js
    it.each([
      ['an empty form', {}, 'email-error', 'Email is required'],
      ['a malformed email', { email: 'not-an-email' }, 'email-error', 'Please enter a valid email address'],
      ['a weak password', { password: 'password' }, 'password-error', 'uppercase'],
      ['passwords that differ', { confirm: 'Different123' }, 'confirm-password-error', 'Passwords do not match'],
    ])('stops %s with a message under the field', (_, values, errorId, message) => {
      renderPage()
      if (Object.keys(values).length) fill(values)

      submit()

      expect(screen.getByTestId(errorId)).toHaveTextContent(message)
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('ties each message to its field for screen readers', () => {
      renderPage()
      fill({ email: 'not-an-email' })

      submit()

      expect(field.email()).toHaveAttribute('aria-invalid', 'true')
      expect(field.email()).toHaveAccessibleDescription('Please enter a valid email address')
      expect(field.password()).toHaveAttribute('aria-invalid', 'false')
    })

    it.each([
      ['email', 'email-error', { email: 'bad' }],
      ['password', 'password-error', { password: 'weak' }],
      ['confirm', 'confirm-password-error', { confirm: 'Different123' }],
    ])('clears the %s message once that field is edited', (name, errorId, values) => {
      renderPage()
      fill(values)
      submit()
      expect(screen.getByTestId(errorId)).toBeInTheDocument()

      fireEvent.change(field[name](), { target: { value: 'edited' } })

      expect(screen.queryByTestId(errorId)).not.toBeInTheDocument()
    })
  })

  describe('submitting', () => {
    it('registers, confirms, and moves on to login two seconds later', async () => {
      vi.useFakeTimers()
      registerUser.mockResolvedValue({ message: 'User created' })
      renderPage()
      fill()

      await act(async () => submit())

      expect(registerUser).toHaveBeenCalledWith('user@example.com', 'Password123')
      expect(screen.getByTestId('success-message')).toBeInTheDocument()

      // Long enough to read the confirmation
      act(() => vi.advanceTimersByTime(1999))
      expect(mockNavigate).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(1))
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    it('does not redirect once the page has been left', async () => {
      vi.useFakeTimers()
      registerUser.mockResolvedValue({ message: 'User created' })
      const { unmount } = renderPage()
      fill()
      await act(async () => submit())

      unmount()
      vi.advanceTimersByTime(3000)

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it.each([
      ['the server refuses', Object.assign(new Error('409'), {
        response: { status: 409, data: errorBody('EMAIL_ALREADY_REGISTERED', 'Email already registered') },
      }), 'Email already registered'],
      ['the network fails', new Error('Network Error'), 'Network error'],
    ])('shows why when %s, and lets the user try again', async (_, error, message) => {
      registerUser.mockRejectedValue(error)
      renderPage()
      fill()

      submit()

      expect(await screen.findByTestId('error-message')).toHaveTextContent(message)
      expect(field.email()).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled()
    })

    it('locks the form while the request is in flight', async () => {
      let finish
      registerUser.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      renderPage()
      fill()

      submit()

      for (const input of Object.values(field)) {
        expect(input()).toBeDisabled()
      }
      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled()
      await act(async () => finish({}))
    })
  })
})
