import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar'
import { AuthProvider } from '../../../contexts/AuthContext'
import { storage } from '../../../utils/storage'
import { logoutUser } from '../../../api/services/authService'

vi.mock('../../../utils/storage')
vi.mock('../../../api/services/authService')

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
    logoutUser.mockResolvedValue({})
  })

  const renderNavbar = (initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    )
  }

  describe('structure', () => {
    it('should render navbar container', () => {
      renderNavbar()

      expect(screen.getByTestId('navbar')).toBeInTheDocument()
      expect(screen.getByTestId('navbar')).toHaveClass('navbar')
    })

    it('should render navbar-container', () => {
      renderNavbar()

      const container = screen.getByTestId('navbar').querySelector('.navbar-container')
      expect(container).toBeInTheDocument()
    })

    it('should render navbar-links section', () => {
      renderNavbar()

      const links = screen.getByTestId('navbar').querySelector('.navbar-links')
      expect(links).toBeInTheDocument()
    })
  })

  describe('when not authenticated', () => {
    describe('on home page', () => {
      it('should show login and register links', () => {
        renderNavbar('/')

        expect(screen.getByText('Login')).toBeInTheDocument()
        expect(screen.getByText('Register')).toBeInTheDocument()
      })

      it('should not show home link', () => {
        renderNavbar('/')

        const homeLinks = screen.queryAllByText('Home')
        expect(homeLinks).toHaveLength(0)
      })

      it('should not show notes link', () => {
        renderNavbar('/')

        expect(screen.queryByText('My Notes')).not.toBeInTheDocument()
      })

      it('should not show user section', () => {
        renderNavbar('/')

        expect(screen.queryByTestId('navbar-user')).not.toBeInTheDocument()
      })
    })

    describe('on login page', () => {
      it('should show home and register links', () => {
        renderNavbar('/login')

        expect(screen.getByText('Home')).toBeInTheDocument()
        expect(screen.getByText('Register')).toBeInTheDocument()
      })

      it('should not show login link', () => {
        renderNavbar('/login')

        const loginLinks = screen.queryAllByText('Login')
        expect(loginLinks).toHaveLength(0)
      })
    })

    describe('on register page', () => {
      it('should show home and login links', () => {
        renderNavbar('/register')

        expect(screen.getByText('Home')).toBeInTheDocument()
        expect(screen.getByText('Login')).toBeInTheDocument()
      })

      it('should not show register link', () => {
        renderNavbar('/register')

        const registerLinks = screen.queryAllByText('Register')
        expect(registerLinks).toHaveLength(0)
      })
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    describe('on home page', () => {
      it('should show notes link', () => {
        renderNavbar('/')

        expect(screen.getByText('My Notes')).toBeInTheDocument()
      })

      it('should not show home link', () => {
        renderNavbar('/')

        const homeLinks = screen.queryAllByText('Home')
        expect(homeLinks).toHaveLength(0)
      })

      it('should not show login or register links', () => {
        renderNavbar('/')

        expect(screen.queryByText('Login')).not.toBeInTheDocument()
        expect(screen.queryByText('Register')).not.toBeInTheDocument()
      })
    })

    describe('on notes page', () => {
      it('should show home link', () => {
        renderNavbar('/notes')

        expect(screen.getByText('Home')).toBeInTheDocument()
      })

      it('should not show notes link', () => {
        renderNavbar('/notes')

        const notesLinks = screen.queryAllByText('My Notes')
        expect(notesLinks).toHaveLength(0)
      })
    })

    describe('user section', () => {
      it('should display user email', () => {
        renderNavbar('/')

        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      it('should display logout button', () => {
        renderNavbar('/')

        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
      })

      it('should render user section with correct testid', () => {
        renderNavbar('/')

        expect(screen.getByTestId('navbar-user')).toBeInTheDocument()
      })
    })
  })

  describe('logout functionality', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    it('should call logoutUser when logout button clicked', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      const logoutBtn = screen.getByRole('button', { name: /logout/i })
      await user.click(logoutBtn)

      expect(logoutUser).toHaveBeenCalledTimes(1)
    })

    it('should clear auth context on logout', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      expect(screen.getByText('test@example.com')).toBeInTheDocument()

      const logoutBtn = screen.getByRole('button', { name: /logout/i })
      await user.click(logoutBtn)

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })

    it('should handle logout API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutUser.mockRejectedValue(new Error('Logout failed'))

      const user = userEvent.setup()
      renderNavbar('/')

      const logoutBtn = screen.getByRole('button', { name: /logout/i })
      await user.click(logoutBtn)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Logout error:', expect.any(Error))
      })

      // Should still clear auth even if API fails
      expect(storage.clearAuth).toHaveBeenCalled()

      consoleError.mockRestore()
    })

    it('should navigate to home after logout', async () => {
      const user = userEvent.setup()
      renderNavbar('/notes')

      const logoutBtn = screen.getByRole('button', { name: /logout/i })
      await user.click(logoutBtn)

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })
  })

  describe('navigation links', () => {
    it('should have correct href for home link', () => {
      renderNavbar('/login')

      const homeLink = screen.getByText('Home')
      expect(homeLink).toHaveAttribute('href', '/')
    })

    it('should have correct href for notes link', () => {
      storage.getAccessToken.mockReturnValue('token')
      renderNavbar('/')

      const notesLink = screen.getByText('My Notes')
      expect(notesLink).toHaveAttribute('href', '/notes')
    })

    it('should have correct href for login link', () => {
      renderNavbar('/')

      const loginLink = screen.getByText('Login')
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should have correct href for register link', () => {
      renderNavbar('/')

      const registerLink = screen.getByText('Register')
      expect(registerLink).toHaveAttribute('href', '/register')
    })
  })
})