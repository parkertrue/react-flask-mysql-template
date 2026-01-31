import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar'
import { AuthProvider } from '../../../contexts/AuthContext'
import { storage } from '../../../utils/storage'

vi.mock('../../../utils/storage')

// Mock LogoutDropdown component
vi.mock('../LogoutDropdown', () => ({
  default: () => <button data-testid="logout-dropdown">Logout ▾</button>
}))

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
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

  describe('structure and rendering', () => {
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

      it('should not show logout dropdown', () => {
        renderNavbar('/')
        expect(screen.queryByTestId('logout-dropdown')).not.toBeInTheDocument()
      })
    })

    describe('on login page', () => {
      it('should show home and register links', () => {
        renderNavbar('/login')
        expect(screen.getByText('Home')).toBeInTheDocument()
        expect(screen.getByText('Register')).toBeInTheDocument()
      })

      it('should not show login link on login page', () => {
        renderNavbar('/login')
        const loginLinks = screen.queryAllByText('Login')
        expect(loginLinks).toHaveLength(0)
      })

      it('should have correct href for home link', () => {
        renderNavbar('/login')
        const homeLink = screen.getByText('Home')
        expect(homeLink).toHaveAttribute('href', '/')
      })
    })

    describe('on register page', () => {
      it('should show home and login links', () => {
        renderNavbar('/register')
        expect(screen.getByText('Home')).toBeInTheDocument()
        expect(screen.getByText('Login')).toBeInTheDocument()
      })

      it('should not show register link on register page', () => {
        renderNavbar('/register')
        const registerLinks = screen.queryAllByText('Register')
        expect(registerLinks).toHaveLength(0)
      })

      it('should have correct href for home link', () => {
        renderNavbar('/register')
        const homeLink = screen.getByText('Home')
        expect(homeLink).toHaveAttribute('href', '/')
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

      it('should have correct href for notes link', () => {
        renderNavbar('/')
        const notesLink = screen.getByText('My Notes')
        expect(notesLink).toHaveAttribute('href', '/notes')
      })

      it('should not show home link on home page', () => {
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

      it('should have correct href for home link', () => {
        renderNavbar('/notes')
        const homeLink = screen.getByText('Home')
        expect(homeLink).toHaveAttribute('href', '/')
      })

      it('should not show notes link on notes page', () => {
        renderNavbar('/notes')
        const notesLinks = screen.queryAllByText('My Notes')
        expect(notesLinks).toHaveLength(0)
      })

      it('should not show login or register links', () => {
        renderNavbar('/notes')
        expect(screen.queryByText('Login')).not.toBeInTheDocument()
        expect(screen.queryByText('Register')).not.toBeInTheDocument()
      })
    })

    describe('user section', () => {
      it('should display user email', () => {
        renderNavbar('/')
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      it('should render user section with correct testid', () => {
        renderNavbar('/')
        expect(screen.getByTestId('navbar-user')).toBeInTheDocument()
      })

      it('should render LogoutDropdown component', () => {
        renderNavbar('/')
        expect(screen.getByTestId('logout-dropdown')).toBeInTheDocument()
      })

      it('should have user-email class on email', () => {
        renderNavbar('/')
        const emailElement = screen.getByText('test@example.com')
        expect(emailElement).toHaveClass('user-email')
      })
    })
  })

  describe('navigation links', () => {
    it('should have nav-link class on all links', () => {
      renderNavbar('/')
      const loginLink = screen.getByText('Login')
      const registerLink = screen.getByText('Register')
      
      expect(loginLink).toHaveClass('nav-link')
      expect(registerLink).toHaveClass('nav-link')
    })

    it('should render links as anchor tags', () => {
      renderNavbar('/')
      const loginLink = screen.getByText('Login')
      const registerLink = screen.getByText('Register')
      
      expect(loginLink.tagName).toBe('A')
      expect(registerLink.tagName).toBe('A')
    })
  })

  describe('conditional rendering based on route', () => {
    it('should adapt navigation for different routes', () => {
      // Home page - unauthenticated
      const { unmount: unmount1 } = renderNavbar('/')
      expect(screen.getByText('Login')).toBeInTheDocument()
      expect(screen.getByText('Register')).toBeInTheDocument()
      unmount1()

      // Login page - unauthenticated
      renderNavbar('/login')
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Register')).toBeInTheDocument()
      expect(screen.queryByText('Login')).not.toBeInTheDocument()
    })

    it('should adapt navigation when authenticated', () => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')

      // Home page - authenticated
      const { unmount: unmount1 } = renderNavbar('/')
      expect(screen.getByText('My Notes')).toBeInTheDocument()
      expect(screen.queryByText('Home')).not.toBeInTheDocument()
      unmount1()

      // Notes page - authenticated
      renderNavbar('/notes')
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.queryByText('My Notes')).not.toBeInTheDocument()
    })
  })

  describe('layout and structure', () => {
    it('should maintain structure across authentication states', () => {
      // Unauthenticated
      const { container: container1, unmount: unmount1 } = renderNavbar('/')
      expect(container1.querySelector('.navbar')).toBeInTheDocument()
      expect(container1.querySelector('.navbar-container')).toBeInTheDocument()
      expect(container1.querySelector('.navbar-links')).toBeInTheDocument()
      unmount1()

      // Authenticated
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')

      const { container: container2 } = renderNavbar('/')
      expect(container2.querySelector('.navbar')).toBeInTheDocument()
      expect(container2.querySelector('.navbar-container')).toBeInTheDocument()
      expect(container2.querySelector('.navbar-links')).toBeInTheDocument()
      expect(container2.querySelector('.navbar-user')).toBeInTheDocument()
    })
  })

  describe('integration with AuthProvider', () => {
    it('should respond to authentication state changes', () => {
      // Initially not authenticated
      const { unmount: unmount1 } = renderNavbar('/')
      expect(screen.queryByTestId('navbar-user')).not.toBeInTheDocument()
      expect(screen.getByText('Login')).toBeInTheDocument()
      unmount1()

      // Change to authenticated
      storage.getAccessToken.mockReturnValue('token')
      storage.getEmail.mockReturnValue('user@example.com')

      renderNavbar('/')
      expect(screen.getByTestId('navbar-user')).toBeInTheDocument()
      expect(screen.getByText('user@example.com')).toBeInTheDocument()
      expect(screen.queryByText('Login')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should use semantic nav element', () => {
      const { container } = renderNavbar('/')
      const nav = container.querySelector('nav')
      expect(nav).toBeInTheDocument()
      expect(nav).toHaveClass('navbar')
    })

    it('should have accessible link text', () => {
      renderNavbar('/')
      expect(screen.getByText('Login')).toHaveAccessibleName()
      expect(screen.getByText('Register')).toHaveAccessibleName()
    })

    it('should have accessible link text when authenticated', () => {
      storage.getAccessToken.mockReturnValue('token')
      storage.getEmail.mockReturnValue('user@example.com')
      
      renderNavbar('/')
      expect(screen.getByText('My Notes')).toHaveAccessibleName()
    })
  })
})
