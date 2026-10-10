import { describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import RegisterPage from '../RegisterPage'
import LoginPage from '../LoginPage'
import { registerUser } from '@/auth/authService'
import { errorBody } from '@/test/fixtures'
import { renderRoutes } from '@/test/router'
import { APP_NAME } from '@/appName'

vi.mock('@/auth/authService')

function renderPage() {
  return renderRoutes([
    { path: '/register', element: <RegisterPage /> },
    { path: '/login', element: <LoginPage /> },
  ], '/register')
}

const field = {
  email: () => screen.getByLabelText('Email'),
  password: () => screen.getByLabelText('Password'),
  confirmPassword: () => screen.getByLabelText('Confirm Password'),
}
const submitButton = () => screen.getByRole('button', { name: /register|creating account/i })

async function fill(user, values = {}) {
  const { email = 'user@example.com', password = 'Password123' } = values
  const { confirmPassword = password } = values
  for (const [name, value] of Object.entries({ email, password, confirmPassword })) {
    if (value) await user.type(field[name](), value)
  }
}

describe('RegisterPage', () => {
  it('shows the form, with the password rules and a way to log in', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Register' })).toBeInTheDocument()
    expect(field.email()).toHaveAttribute('autocomplete', 'email')
    expect(field.password()).toHaveAttribute('autocomplete', 'new-password')
    expect(field.confirmPassword()).toHaveAttribute('autocomplete', 'new-password')
    // Up front, not one at a time after each failed attempt
    expect(field.password()).toHaveAccessibleDescription(/at least 8 characters.*uppercase.*lowercase.*number/i)
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login')
    expect(document.title).toBe(`Register | ${APP_NAME}`)
  })

  describe('validation', () => {
    // One example per field: the rules themselves are covered in validation.test.js
    it.each([
      ['an empty form', { email: '', password: '' }, 'email', 'Email is required'],
      ['a malformed email', { email: 'not-an-email' }, 'email', 'Please enter a valid email address'],
      ['a weak password', { password: 'password' }, 'password', 'uppercase'],
      ['passwords that differ', { confirmPassword: 'Different123' }, 'confirmPassword', 'Passwords do not match'],
    ])('stops %s, explains, and focuses the first bad field', async (_, values, name, message) => {
      const { user } = renderPage()
      await fill(user, values)

      await user.click(submitButton())

      expect(field[name]()).toHaveAttribute('aria-invalid', 'true')
      expect(field[name]()).toHaveAccessibleDescription(expect.stringContaining(message))
      expect(field[name]()).toHaveFocus()
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('clears a field\'s message once it is edited', async () => {
      const { user } = renderPage()
      await fill(user, { confirmPassword: 'Different123' })
      await user.click(submitButton())

      await user.type(field.confirmPassword(), 'x')

      expect(field.confirmPassword()).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('submitting', () => {
    it('registers and goes straight to the login page, which confirms it', async () => {
      registerUser.mockResolvedValue({ message: 'User created' })
      const { user } = renderPage()
      await fill(user)

      await user.click(submitButton())

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Registration successful')
      expect(registerUser).toHaveBeenCalledWith('user@example.com', 'Password123')
    })

    it.each([
      ['the server refuses', Object.assign(new Error('409'), {
        response: { status: 409, data: errorBody('EMAIL_ALREADY_REGISTERED', 'Email already registered') },
      }), 'Email already registered'],
      ['the network fails', new Error('Network Error'), 'Network error'],
    ])('announces why when %s, and lets the user try again', async (_, error, message) => {
      registerUser.mockRejectedValue(error)
      const { user } = renderPage()
      await fill(user)

      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(submitButton()).toHaveAttribute('aria-disabled', 'false')
      expect(field.email()).not.toHaveAttribute('readonly')
    })

    it('keeps focus and ignores repeat submits while the request is in flight', async () => {
      let finish
      registerUser.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      const { user } = renderPage()
      await fill(user)

      await user.click(submitButton())
      await user.click(submitButton())

      expect(submitButton()).toHaveTextContent('Creating account...')
      expect(submitButton()).toHaveAttribute('aria-disabled', 'true')
      expect(submitButton()).toHaveFocus()
      for (const input of Object.values(field)) {
        expect(input()).toHaveAttribute('readonly')
      }
      expect(registerUser).toHaveBeenCalledTimes(1)
      await act(async () => finish({}))
    })
  })
})
