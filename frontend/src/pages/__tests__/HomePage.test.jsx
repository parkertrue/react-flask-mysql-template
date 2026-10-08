import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../HomePage'
import { AuthProvider } from '../../contexts/AuthProvider'
import { storage } from '../../utils/storage'

vi.mock('../../utils/storage')
// Tested on its own; a stub keeps these tests off the health endpoint
vi.mock('../../components/health/ApiStatus', () => ({
  default: () => <div data-testid="api-status-demo" />
}))

function renderHomePage({ signedIn = false } = {}) {
  storage.getAccessToken.mockReturnValue(signedIn ? 'token' : null)
  storage.getEmail.mockReturnValue(signedIn ? 'user@example.com' : null)
  render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>
  )
}

const links = () => Object.fromEntries(
  screen.queryAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])
)

describe('HomePage', () => {
  beforeEach(() => {
    storage.getRefreshCsrf.mockReturnValue(null)
  })

  it('welcomes the visitor and shows the API status demo', () => {
    renderHomePage()

    expect(screen.getByRole('heading', { name: /welcome/i })).toBeInTheDocument()
    expect(screen.getByTestId('api-status-demo')).toBeInTheDocument()
  })

  it('offers a visitor registration and login', () => {
    renderHomePage()

    expect(links()).toEqual({ 'Get Started': '/register', Login: '/login' })
  })

  it('offers a signed-in user their notes instead', () => {
    renderHomePage({ signedIn: true })

    expect(links()).toEqual({ 'View My Notes': '/notes' })
  })
})
