import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import App from '../../App'
import { storage } from '../../utils/storage'
import { errorBody, notesPage } from '../fixtures'
import { handlers, setupMswServer } from '../server'

// The whole app against the real axios client, with the network faked at the
// HTTP layer. Every endpoint answers its happy path unless a test says not.
const server = setupMswServer(...handlers)

function renderAppAt(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

async function fillRegistration(user, email) {
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/^password$/i), 'Password123')
  await user.type(screen.getByLabelText(/confirm password/i), 'Password123')
  await user.click(screen.getByRole('button', { name: /register/i }))
}

async function fillLogin(user, password = 'Password123') {
  await user.type(screen.getByLabelText(/email/i), 'test@example.com')
  await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /login/i }))
}

describe('Authentication Flow Integration Tests', () => {
  describe('Registration Flow', () => {
    it('registers and moves on to the login page', async () => {
      const user = userEvent.setup()
      renderAppAt('/register')

      await fillRegistration(user, 'test@example.com')

      expect(
        await screen.findByRole('heading', { name: /login/i }, { timeout: 3000 })
      ).toBeInTheDocument()
    })

    it('shows the server message when the email is taken', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/auth/register', () => HttpResponse.json(
          errorBody('EMAIL_ALREADY_REGISTERED', 'Email already registered'),
          { status: 409 }))
      )
      renderAppAt('/register')

      await fillRegistration(user, 'existing@example.com')

      expect(await screen.findByTestId('error-message'))
        .toHaveTextContent(/email already registered/i)
    })
  })

  describe('Login Flow', () => {
    it('logs in and loads the user\'s notes with the new token', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/notes', ({ request }) => {
          if (request.headers.get('Authorization') !== 'Bearer access-token') {
            return HttpResponse.json(errorBody('AUTH_MISSING_TOKEN'), { status: 401 })
          }
          return HttpResponse.json(notesPage([
            { id: 2, content: 'Second note' },
            { id: 1, content: 'First note' },
          ]))
        })
      )
      renderAppAt('/login')

      await fillLogin(user)

      expect(await screen.findByText('First note', {}, { timeout: 3000 })).toBeInTheDocument()
      expect(screen.getByText('Second note')).toBeInTheDocument()
    })

    it('shows the server message on invalid credentials', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/auth/login', () => HttpResponse.json(
          errorBody('INVALID_CREDENTIALS', 'Invalid email or password'),
          { status: 401 }))
      )
      renderAppAt('/login')

      await fillLogin(user, 'WrongPassword123')

      expect(await screen.findByTestId('error-message'))
        .toHaveTextContent(/invalid email or password/i)
    })
  })

  describe('Notes', () => {
    it('creates a note and shows it', async () => {
      const user = userEvent.setup()
      storage.setAccessToken('access-token')
      renderAppAt('/notes')

      await screen.findByText(/no notes yet/i)
      await user.type(screen.getByLabelText('New note'), 'My new test note')
      await user.click(screen.getByTestId('note-submit'))

      expect(await screen.findByText('My new test note')).toBeInTheDocument()
    })
  })

  describe('Authentication State', () => {
    it('keeps a stored session across a page load', async () => {
      storage.setAccessToken('access-token')
      server.use(
        http.get('/api/notes', () =>
          HttpResponse.json(notesPage([{ id: 1, content: 'Persisted note' }])))
      )

      renderAppAt('/notes')

      expect(await screen.findByText('Persisted note')).toBeInTheDocument()
    })

    it('sends a visitor without a session to the login page', async () => {
      // No handler is needed: the route guard redirects before any request,
      // and an unexpected request would fail the test
      renderAppAt('/notes')

      expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument()
    })
  })
})
