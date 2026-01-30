import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar'
import { AuthProvider } from '../../../contexts/AuthContext'
import { storage } from '../../../utils/storage'
import { logoutUser, logoutAllDevices } from '../../../api/services/authService'

vi.mock('../../../utils/storage')
vi.mock('../../../api/services/authService')

const mockConfirm = vi.fn()
global.confirm = mockConfirm

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
    logoutUser.mockResolvedValue({})
    logoutAllDevices.mockResolvedValue({})
    mockConfirm.mockReturnValue(true)
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

  describe('dropdown functionality', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    describe('dropdown toggle', () => {
      it('should not show dropdown menu initially', () => {
        renderNavbar('/')
        expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
        expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
      })

      it('should show dropdown menu when logout button clicked', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })
        await user.click(logoutBtn)

        expect(screen.getByText('Logout This Device')).toBeInTheDocument()
        expect(screen.getByText('Logout All Devices')).toBeInTheDocument()
      })

      it('should toggle dropdown on multiple clicks', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })

        await user.click(logoutBtn)
        expect(screen.getByText('Logout This Device')).toBeInTheDocument()

        await user.click(logoutBtn)
        expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()

        await user.click(logoutBtn)
        expect(screen.getByText('Logout This Device')).toBeInTheDocument()
      })

      it('should show down caret when closed', () => {
        renderNavbar('/')
        expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()
      })

      it('should show up caret when open', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })
        await user.click(logoutBtn)

        expect(screen.getByText(/logout ▴/i)).toBeInTheDocument()
      })

      it('should toggle caret direction on multiple clicks', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })

        expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()

        await user.click(logoutBtn)
        expect(screen.getByText(/logout ▴/i)).toBeInTheDocument()

        await user.click(logoutBtn)
        expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()
      })
    })

    describe('click outside to close', () => {
      it('should close dropdown when clicking outside', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })
        await user.click(logoutBtn)
        expect(screen.getByText('Logout This Device')).toBeInTheDocument()

        await user.click(document.body)

        await waitFor(() => {
          expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
        })
      })

      it('should reset caret when clicking outside', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })
        await user.click(logoutBtn)
        expect(screen.getByText(/logout ▴/i)).toBeInTheDocument()

        await user.click(document.body)

        await waitFor(() => {
          expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()
        })
      })

      it('should not close dropdown when clicking inside dropdown', async () => {
        const user = userEvent.setup()
        const { container } = renderNavbar('/')

        const logoutBtn = screen.getByRole('button', { name: /logout/i })
        await user.click(logoutBtn)

        const dropdownMenu = container.querySelector('.dropdown-menu')
        await user.click(dropdownMenu)

        expect(screen.getByText('Logout This Device')).toBeInTheDocument()
      })
    })

    describe('dropdown menu structure', () => {
      it('should render dropdown menu with correct class', async () => {
        const user = userEvent.setup()
        const { container } = renderNavbar('/')

        await user.click(screen.getByRole('button', { name: /logout/i }))

        const menu = container.querySelector('.dropdown-menu')
        expect(menu).toBeInTheDocument()
      })

      it('should render both menu items', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        await user.click(screen.getByRole('button', { name: /logout/i }))

        const menuItems = screen.getAllByRole('button').filter(btn => 
          btn.textContent.includes('Logout This Device') || 
          btn.textContent.includes('Logout All Devices')
        )
        expect(menuItems).toHaveLength(2)
      })

      it('should have correct class on menu items', async () => {
        const user = userEvent.setup()
        renderNavbar('/')

        await user.click(screen.getByRole('button', { name: /logout/i }))

        const logoutThis = screen.getByText('Logout This Device')
        const logoutAll = screen.getByText('Logout All Devices')

        expect(logoutThis).toHaveClass('dropdown-item')
        expect(logoutAll).toHaveClass('dropdown-item', 'dropdown-danger')
      })
    })
  })

  describe('logout single device functionality', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    it('should call logoutUser when "Logout This Device" clicked', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      expect(logoutUser).toHaveBeenCalledTimes(1)
    })

    it('should clear auth context on logout', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })

    it('should close dropdown after logout', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
      })
    })

    it('should handle logout API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutUser.mockRejectedValue(new Error('Logout failed'))

      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Logout error:', expect.any(Error))
      })

      expect(storage.clearAuth).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('should still clear auth even if API fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutUser.mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })

      consoleError.mockRestore()
    })
  })

  describe('logout all devices functionality', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    it('should show confirmation dialog when "Logout All Devices" clicked', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      expect(mockConfirm).toHaveBeenCalled()
      expect(mockConfirm).toHaveBeenCalledWith(expect.stringContaining('Logout from all devices'))
    })

    it('should call logoutAllDevices when confirmed', async () => {
      mockConfirm.mockReturnValue(true)
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(logoutAllDevices).toHaveBeenCalledTimes(1)
      })
    })

    it('should not call logoutAllDevices when cancelled', async () => {
      mockConfirm.mockReturnValue(false)
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      expect(logoutAllDevices).not.toHaveBeenCalled()
    })

    it('should clear auth context on successful logout all', async () => {
      mockConfirm.mockReturnValue(true)
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })

    it('should close dropdown after logout all', async () => {
      mockConfirm.mockReturnValue(true)
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
      })
    })

    it('should handle logout all API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConfirm.mockReturnValue(true)
      logoutAllDevices.mockRejectedValue(new Error('Logout all failed'))

      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Logout all error:', expect.any(Error))
      })

      expect(storage.clearAuth).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('should close dropdown when user cancels confirmation', async () => {
      mockConfirm.mockReturnValue(false)
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      expect(screen.getByText('Logout All Devices')).toBeInTheDocument()

      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
      })
    })

    it('should still clear auth even if API fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConfirm.mockReturnValue(true)
      logoutAllDevices.mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })

      consoleError.mockRestore()
    })

    it('should not logout if user cancels', async () => {
      mockConfirm.mockReturnValue(false)
      const user = userEvent.setup()
      renderNavbar('/')

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      expect(storage.clearAuth).not.toHaveBeenCalled()
    })
  })

  describe('edge cases and cleanup', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    it('should cleanup event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const { unmount } = renderNavbar('/')

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
      removeEventListenerSpy.mockRestore()
    })

    it('should handle rapid dropdown toggles', async () => {
      const user = userEvent.setup()
      renderNavbar('/')

      const logoutBtn = screen.getByRole('button', { name: /logout/i })

      await user.click(logoutBtn)
      await user.click(logoutBtn)
      await user.click(logoutBtn)
      await user.click(logoutBtn)

      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
    })
  })
})
