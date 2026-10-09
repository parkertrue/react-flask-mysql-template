import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { routes } from '../routes'
import HomePage from '@/pages/HomePage'
import { renderRoutes, signIn } from '@/test/router'

// Each page has its own tests; here they only need to say which they are
vi.mock('@/pages/HomePage', () => ({ default: vi.fn(() => <p>Home page</p>) }))
vi.mock('@/pages/LoginPage', () => ({ default: () => <p>Login page</p> }))
vi.mock('@/pages/RegisterPage', () => ({ default: () => <p>Register page</p> }))
vi.mock('@/pages/AccountPage', () => ({ default: () => <p>Account page</p> }))
vi.mock('@/features/notes/NotesPage', () => ({ default: () => <p>Notes page</p> }))

const page = () => screen.getByRole('main')

describe('routes', () => {
  it.each([
    ['/', 'Home page'],
    ['/login', 'Login page'],
    ['/register', 'Register page'],
    // Guarded: a visitor is sent to log in
    ['/notes', 'Login page'],
    ['/account', 'Login page'],
  ])('show a visitor at %s the %s', (path, expected) => {
    renderRoutes(routes, path)

    expect(page()).toHaveTextContent(expected)
  })

  it.each([
    ['/', 'Home page'],
    ['/notes', 'Notes page'],
    ['/account', 'Account page'],
    // A signed-in user has no use for these
    ['/login', 'Notes page'],
    ['/register', 'Notes page'],
  ])('show a signed-in user at %s the %s', (path, expected) => {
    signIn()
    renderRoutes(routes, path)

    expect(page()).toHaveTextContent(expected)
  })

  it('say so at an unknown address, under the navbar', () => {
    renderRoutes(routes, '/no-such-page')

    expect(within(page()).getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('show an error page in place of a page that crashes, keeping the navbar', () => {
    // React and the router log the error; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    HomePage.mockImplementation(() => { throw new Error('Broken page') })

    renderRoutes(routes, '/')

    expect(within(page()).getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
