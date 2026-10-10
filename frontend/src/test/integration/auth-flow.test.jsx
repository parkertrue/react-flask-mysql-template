import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { routes } from '@/routes'
import { storage } from '@/auth/storage'
import { notesHandlers, notesPage } from '@/features/notes/__tests__/fixtures'
import { errorBody } from '../fixtures'
import { renderRoutes, signIn } from '../router'
import { handlers, setupMswServer } from '../server'

// The whole app against the real axios client, with the network faked at the
// HTTP layer. Every endpoint answers its happy path unless a test says not.
const server = setupMswServer(...handlers, ...notesHandlers)

async function fillRegistration(user, email) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), 'Password123')
  await user.type(screen.getByLabelText('Confirm Password'), 'Password123')
  await user.click(screen.getByRole('button', { name: 'Register' }))
}

async function fillLogin(user, password = 'Password123') {
  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Login' }))
}

describe('Authentication Flow Integration Tests', () => {
  describe('Registration Flow', () => {
    it('registers and moves on to the login page, which confirms it', async () => {
      const { user } = renderRoutes(routes, '/register')

      await fillRegistration(user, 'test@example.com')

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Registration successful')
    })

    it('shows the server message when the email is taken', async () => {
      server.use(
        http.post('/api/auth/register', () => HttpResponse.json(
          errorBody('EMAIL_ALREADY_REGISTERED', 'Email already registered'),
          { status: 409 }))
      )
      const { user } = renderRoutes(routes, '/register')

      await fillRegistration(user, 'existing@example.com')

      expect(await screen.findByRole('alert')).toHaveTextContent(/email already registered/i)
    })
  })

  describe('Login Flow', () => {
    it('logs in and loads the user\'s notes with the new token', async () => {
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
      const { user } = renderRoutes(routes, '/login')

      await fillLogin(user)

      expect(await screen.findByText('First note')).toBeInTheDocument()
      expect(screen.getByText('Second note')).toBeInTheDocument()
    })

    it('shows the server message on invalid credentials', async () => {
      server.use(
        http.post('/api/auth/login', () => HttpResponse.json(
          errorBody('INVALID_CREDENTIALS', 'Invalid email or password'),
          { status: 401 }))
      )
      const { user } = renderRoutes(routes, '/login')

      await fillLogin(user, 'WrongPassword123')

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i)
    })
  })

  describe('Notes', () => {
    it('creates a note and shows it', async () => {
      signIn()
      const { user } = renderRoutes(routes, '/notes')

      await screen.findByText(/no notes yet/i)
      await user.type(screen.getByLabelText('New note'), 'My new test note')
      await user.click(screen.getByRole('button', { name: 'Add Note' }))

      expect(await screen.findByText('My new test note')).toBeInTheDocument()
    })

    it('edits a note, then deletes it', async () => {
      signIn()
      server.use(
        http.get('/api/notes', () =>
          HttpResponse.json(notesPage([{ id: 1, content: 'Draft' }])))
      )
      const { user } = renderRoutes(routes, '/notes')

      await user.click(await screen.findByRole('button', { name: 'Edit note #1' }))
      const field = screen.getByRole('textbox', { name: 'Edit note #1' })
      await user.clear(field)
      await user.type(field, 'Final')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByText('Final')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Delete note #1' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument()
    })

    it('shows the API\'s message when the note is already gone', async () => {
      signIn()
      server.use(
        http.get('/api/notes', () =>
          HttpResponse.json(notesPage([{ id: 1, content: 'Stale' }]))),
        http.delete('/api/notes/:id', () =>
          HttpResponse.json(errorBody('NOT_FOUND', 'Resource not found'), { status: 404 }))
      )
      const { user } = renderRoutes(routes, '/notes')

      await user.click(await screen.findByRole('button', { name: 'Delete note #1' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Resource not found')
      expect(screen.getByText('Stale')).toBeInTheDocument()
    })
  })

  describe('Authentication State', () => {
    it('keeps a stored session across a page load', async () => {
      signIn()
      server.use(
        http.get('/api/notes', () =>
          HttpResponse.json(notesPage([{ id: 1, content: 'Persisted note' }])))
      )

      renderRoutes(routes, '/notes')

      expect(await screen.findByText('Persisted note')).toBeInTheDocument()
    })

    it('sends a visitor without a session to the login page', async () => {
      // No handler is needed: the route guard redirects before any request,
      // and an unexpected request would fail the test
      renderRoutes(routes, '/notes')

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
    })

    it('shows the login page, without a reload, when the session cannot be refreshed', async () => {
      signIn()
      server.use(
        http.get('/api/notes', () =>
          HttpResponse.json(errorBody('AUTH_TOKEN_EXPIRED'), { status: 401 })),
        http.post('/api/auth/refresh', () =>
          HttpResponse.json(errorBody('AUTH_TOKEN_REVOKED'), { status: 401 }))
      )

      const { router } = renderRoutes(routes, '/notes')

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
      expect(storage.getAccessToken()).toBeNull()
      expect(window.location.href).toBe('http://localhost/')
      // Logging in again returns to the notes
      expect(router.state.location.state.from.pathname).toBe('/notes')
    })
  })
})
