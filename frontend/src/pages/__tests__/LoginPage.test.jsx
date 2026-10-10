import { describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import LoginPage from '../LoginPage'
import GuestRoute from '@/auth/GuestRoute'
import { storage } from '@/auth/storage'
import { loginUser } from '@/auth/authService'
import { errorBody, tokens } from '@/test/fixtures'
import { renderRoutes } from '@/test/router'
import { APP_NAME } from '@/appName'

vi.mock('@/auth/authService')

function renderPage(entry = '/login') {
  return renderRoutes([
    { element: <GuestRoute />, children: [{ path: '/login', element: <LoginPage /> }] },
    { path: '/notes', element: <p>Notes page</p> },
  ], entry)
}

const field = {
  email: () => screen.getByLabelText('Email'),
  password: () => screen.getByLabelText('Password'),
}
const submitButton = () => screen.getByRole('button', { name: /login|logging in/i })

async function fill(user, { email = 'user@example.com', password = 'Password123' } = {}) {
  if (email) await user.type(field.email(), email)
  if (password) await user.type(field.password(), password)
}

const failure = (status, code, message) => Object.assign(new Error(String(status)), {
  response: { status, data: errorBody(code, message) },
})

describe('LoginPage', () => {
  it('shows the form, with a way to register', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Login' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Login' })).toBeInTheDocument()
    expect(field.email()).toHaveAttribute('autocomplete', 'email')
    expect(field.password()).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register')
    expect(document.title).toBe(`Login | ${APP_NAME}`)
  })

  it('confirms a registration that just happened', () => {
    renderPage({ pathname: '/login', state: { registered: true } })

    expect(screen.getByRole('status')).toHaveTextContent('Registration successful')
  })

  describe('validation', () => {
    it.each([
      ['a malformed email', { email: 'not-an-email' }, 'email', 'Please enter a valid email address'],
      ['an empty password', { password: '' }, 'password', 'Password is required'],
      // The characters registration allows apply here too
      ['a password with a space', { password: 'Pass word123' }, 'password',
        'Password must not contain spaces'],
      ['a password with an emoji', { password: 'Password123😀' }, 'password',
        'Password must not contain emoji or other symbols like © or °'],
      ['an email with non-ASCII before the @', { email: 'josé@example.com' }, 'email',
        'Before the @, an email can use only English letters, numbers and symbols like . _ + -'],
    ])('stops %s, explains, and focuses the field', async (_, values, name, message) => {
      const { user } = renderPage()
      await fill(user, values)

      await user.click(submitButton())

      expect(field[name]()).toHaveAttribute('aria-invalid', 'true')
      expect(field[name]()).toHaveAccessibleDescription(message)
      expect(field[name]()).toHaveFocus()
      expect(loginUser).not.toHaveBeenCalled()
    })

    it('does not apply the registration password strength rules', async () => {
      // Tightening them must never lock out passwords that predate the change
      loginUser.mockResolvedValue(tokens())
      const { user } = renderPage()
      await fill(user, { password: 'weak' })

      await user.click(submitButton())

      expect(loginUser).toHaveBeenCalledWith('user@example.com', 'weak')
      await screen.findByText('Notes page')
    })

    it('clears a field\'s message once it is edited', async () => {
      const { user } = renderPage()
      await fill(user, { email: 'bad' })
      await user.click(submitButton())

      await user.type(field.email(), 'x')

      expect(field.email()).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('submitting', () => {
    it('stores the issued session and moves on to the notes', async () => {
      loginUser.mockResolvedValue(tokens('access', 'csrf'))
      const { user } = renderPage()
      await fill(user)

      await user.click(submitButton())

      expect(await screen.findByText('Notes page')).toBeInTheDocument()
      expect(loginUser).toHaveBeenCalledWith('user@example.com', 'Password123')
      expect(storage.getAccessToken()).toBe('access')
      expect(storage.getRefreshCsrf()).toBe('csrf')
      expect(storage.getEmail()).toBe('user@example.com')
    })

    it.each([
      ['the credentials are wrong',
        failure(401, 'INVALID_CREDENTIALS', 'Invalid email or password'), 'Invalid email or password'],
      ['the network fails', new Error('Network Error'), 'Network error'],
    ])('announces why when %s, and lets the user try again', async (_, error, message) => {
      loginUser.mockRejectedValue(error)
      const { user } = renderPage()
      await fill(user)

      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(storage.getAccessToken()).toBeNull()
      expect(submitButton()).toHaveAttribute('aria-disabled', 'false')
    })

    it('keeps focus and ignores repeat submits while the request is in flight', async () => {
      let finish
      loginUser.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      const { user } = renderPage()
      await fill(user)

      await user.click(submitButton())
      await user.click(submitButton())

      expect(submitButton()).toHaveTextContent('Logging in...')
      expect(submitButton()).toHaveAttribute('aria-disabled', 'true')
      expect(submitButton()).toHaveFocus()
      expect(field.email()).toHaveAttribute('readonly')
      expect(loginUser).toHaveBeenCalledTimes(1)
      await act(async () => finish(tokens()))
    })
  })
})
