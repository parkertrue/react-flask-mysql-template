import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar'
import { AuthProvider } from '../../../contexts/AuthProvider'
import { storage } from '../../../utils/storage'

vi.mock('../../../utils/storage')

// The dropdown has its own tests; here it only needs to be there or not
vi.mock('../LogoutDropdown', () => ({
  default: () => <button>Logout ▾</button>
}))

function renderNavbar(path, { signedIn = false } = {}) {
  storage.getAccessToken.mockReturnValue(signedIn ? 'token' : null)
  storage.getEmail.mockReturnValue(signedIn ? 'user@example.com' : null)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Navbar />
      </AuthProvider>
    </MemoryRouter>
  )
}

/** The navigation links shown, as { text: href } */
const links = () => Object.fromEntries(
  within(screen.getByRole('navigation')).queryAllByRole('link')
    .map(link => [link.textContent, link.getAttribute('href')])
)

describe('Navbar', () => {
  beforeEach(() => {
    storage.getRefreshCsrf.mockReturnValue(null)
  })

  // Each page leaves out the link to itself
  it.each([
    ['/', { Login: '/login', Register: '/register' }],
    ['/login', { Home: '/', Register: '/register' }],
    ['/register', { Home: '/', Login: '/login' }],
  ])('offers a visitor on %s the way in', (path, expected) => {
    renderNavbar(path)

    expect(links()).toEqual(expected)
    expect(screen.queryByTestId('navbar-user')).not.toBeInTheDocument()
  })

  it.each([
    ['/', { 'My Notes': '/notes' }],
    ['/notes', { Home: '/' }],
  ])('offers a signed-in user on %s the other page', (path, expected) => {
    renderNavbar(path, { signedIn: true })

    expect(links()).toEqual(expected)
  })

  it('shows who is signed in, with the logout menu', () => {
    renderNavbar('/notes', { signedIn: true })

    const account = screen.getByTestId('navbar-user')
    expect(within(account).getByText('user@example.com')).toBeInTheDocument()
    expect(within(account).getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })
})
