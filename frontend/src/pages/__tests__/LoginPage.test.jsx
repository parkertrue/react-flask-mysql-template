import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from '../LoginPage'
import { AuthContext } from '../../contexts/AuthContext'
import { loginUser } from '../../api/services/authService'
import { errorBody, tokens } from '../../test/fixtures'

vi.mock('../../api/services/authService')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderPage({ isAuthenticated = false } = {}) {
  const auth = { isAuthenticated, login: vi.fn(), logout: vi.fn() }
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/notes" element={<p>Notes page</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return auth
}

const field = {
  email: () => screen.getByLabelText(/^email$/i),
  password: () => screen.getByLabelText(/^password$/i),
}

function fill({ email = 'user@example.com', password = 'Password123' } = {}) {
  fireEvent.change(field.email(), { target: { value: email } })
  fireEvent.change(field.password(), { target: { value: password } })
}

const submit = () => fireEvent.submit(screen.getByTestId('login-form'))

describe('LoginPage', () => {
  it('shows the form, with a way to register', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
    expect(field.email()).toHaveAttribute('type', 'email')
    expect(field.password()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register')
  })

  it('sends a signed-in user to their notes', () => {
    renderPage({ isAuthenticated: true })

    expect(screen.getByText('Notes page')).toBeInTheDocument()
  })

  describe('validation', () => {
    it.each([
      ['a malformed email', { email: 'not-an-email' }, 'email', 'Please enter a valid email address'],
      ['an empty password', { password: '' }, 'password', 'Password is required'],
    ])('stops %s with a message tied to the field', (_, values, name, message) => {
      renderPage()
      fill(values)

      submit()

      expect(field[name]()).toHaveAttribute('aria-invalid', 'true')
      expect(field[name]()).toHaveAccessibleDescription(message)
      expect(loginUser).not.toHaveBeenCalled()
    })

    it('does not apply the registration password rules', async () => {
      // Tightening them must never lock out passwords that predate the change
      loginUser.mockResolvedValue(tokens())
      renderPage()
      fill({ password: 'weak' })

      await act(async () => submit())

      expect(loginUser).toHaveBeenCalledWith('user@example.com', 'weak')
    })

    it.each([
      ['email', { email: 'bad' }],
      ['password', { password: '' }],
    ])('clears the %s message once that field is edited', (name, values) => {
      renderPage()
      fill(values)
      submit()
      expect(field[name]()).toHaveAttribute('aria-invalid', 'true')

      fireEvent.change(field[name](), { target: { value: 'edited' } })

      expect(field[name]()).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('submitting', () => {
    it('signs in with the issued tokens and opens the notes', async () => {
      loginUser.mockResolvedValue(tokens('access', 'csrf'))
      const auth = renderPage()
      fill()

      await act(async () => submit())

      expect(loginUser).toHaveBeenCalledWith('user@example.com', 'Password123')
      expect(auth.login).toHaveBeenCalledWith('access', 'csrf', 'user@example.com')
      expect(mockNavigate).toHaveBeenCalledWith('/notes')
    })

    it.each([
      ['the credentials are wrong', Object.assign(new Error('401'), {
        response: { status: 401, data: errorBody('INVALID_CREDENTIALS', 'Invalid email or password') },
      }), 'Invalid email or password'],
      ['the network fails', new Error('Network Error'), 'Network error'],
    ])('shows why when %s, and lets the user try again', async (_, error, message) => {
      loginUser.mockRejectedValue(error)
      const auth = renderPage()
      fill()

      submit()

      expect(await screen.findByTestId('error-message')).toHaveTextContent(message)
      expect(auth.login).not.toHaveBeenCalled()
      expect(field.email()).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
    })

    it('locks the form while the request is in flight', async () => {
      let finish
      loginUser.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      renderPage()
      fill()

      submit()

      expect(field.email()).toBeDisabled()
      expect(field.password()).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()
      await act(async () => finish(tokens()))
    })
  })
})
