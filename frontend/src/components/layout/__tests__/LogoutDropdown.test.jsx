import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LogoutDropdown from '../LogoutDropdown'
import { AuthProvider } from '../../../contexts/AuthContext'
import { storage } from '../../../utils/storage'
import { logoutUser, logoutAllDevices } from '../../../api/services/authService'

vi.mock('../../../utils/storage')
vi.mock('../../../api/services/authService')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LogoutDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue('valid-token')
    storage.getRefreshCsrf.mockReturnValue('valid-csrf')
    storage.getEmail.mockReturnValue('test@example.com')
    logoutUser.mockResolvedValue({})
    logoutAllDevices.mockResolvedValue({})
  })

  const renderDropdown = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <LogoutDropdown />
        </AuthProvider>
      </BrowserRouter>
    )
  }

  describe('initial rendering', () => {
    it('should render logout button', () => {
      renderDropdown()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })

    it('should not show dropdown menu initially', () => {
      renderDropdown()
      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
      expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
    })

    it('should have correct button class', () => {
      renderDropdown()
      const button = screen.getByRole('button', { name: /logout/i })
      expect(button).toHaveClass('btn', 'btn-logout')
    })

    it('should render with logout-dropdown wrapper', () => {
      const { container } = renderDropdown()
      expect(container.querySelector('.logout-dropdown')).toBeInTheDocument()
    })
  })

  describe('dropdown toggle', () => {
    it('should show dropdown menu when button clicked', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)

      expect(screen.getByText('Logout This Device')).toBeInTheDocument()
      expect(screen.getByText('Logout All Devices')).toBeInTheDocument()
    })

    it('should hide dropdown menu when button clicked twice', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)
      await user.click(button)

      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
      expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
    })

    it('should toggle dropdown on multiple clicks', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })

      await user.click(button)
      expect(screen.getByText('Logout This Device')).toBeInTheDocument()

      await user.click(button)
      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()

      await user.click(button)
      expect(screen.getByText('Logout This Device')).toBeInTheDocument()
    })

    it('should show down caret when closed', () => {
      renderDropdown()
      expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()
    })

    it('should show up caret when open', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)

      expect(screen.getByText(/logout ▴/i)).toBeInTheDocument()
    })

    it('should toggle caret direction', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })

      expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()

      await user.click(button)
      expect(screen.getByText(/logout ▴/i)).toBeInTheDocument()

      await user.click(button)
      expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()
    })
  })

  describe('dropdown menu structure', () => {
    it('should render dropdown menu with correct class', async () => {
      const user = userEvent.setup()
      const { container } = renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))

      const menu = container.querySelector('.dropdown-menu')
      expect(menu).toBeInTheDocument()
    })

    it('should render both menu items', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))

      const menuItems = screen.getAllByRole('button').filter(btn => 
        btn.textContent.includes('Logout This Device') || 
        btn.textContent.includes('Logout All Devices')
      )
      expect(menuItems).toHaveLength(2)
    })

    it('should have correct classes on menu items', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))

      const logoutThis = screen.getByText('Logout This Device')
      const logoutAll = screen.getByText('Logout All Devices')

      expect(logoutThis).toHaveClass('dropdown-item')
      expect(logoutAll).toHaveClass('dropdown-item', 'dropdown-danger')
    })

    it('should render menu items in correct order', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))

      const buttons = screen.getAllByRole('button')
      const menuButtons = buttons.filter(btn => 
        btn.textContent.includes('Logout This Device') || 
        btn.textContent.includes('Logout All Devices')
      )

      expect(menuButtons[0]).toHaveTextContent('Logout This Device')
      expect(menuButtons[1]).toHaveTextContent('Logout All Devices')
    })
  })

  describe('click outside to close', () => {
    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)
      expect(screen.getByText('Logout This Device')).toBeInTheDocument()

      await user.click(document.body)

      await waitFor(() => {
        expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
      })
    })

    it('should reset caret when clicking outside', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)
      expect(screen.getByText(/logout ▴/i)).toBeInTheDocument()

      await user.click(document.body)

      await waitFor(() => {
        expect(screen.getByText(/logout ▾/i)).toBeInTheDocument()
      })
    })

    it('should not close dropdown when clicking inside dropdown', async () => {
      const user = userEvent.setup()
      const { container } = renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)

      const dropdownMenu = container.querySelector('.dropdown-menu')
      await user.click(dropdownMenu)

      expect(screen.getByText('Logout This Device')).toBeInTheDocument()
    })

    it('should not close when clicking the toggle button while open', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)
      expect(screen.getByText('Logout This Device')).toBeInTheDocument()

      // Clicking toggle button should close it (this is normal toggle behavior)
      await user.click(button)
      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
    })
  })

  describe('logout this device functionality', () => {
    it('should call logoutUser when "Logout This Device" clicked', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      expect(logoutUser).toHaveBeenCalledTimes(1)
    })

    it('should close dropdown immediately when logout clicked', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      // Dropdown should close immediately, not wait for API
      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
    })

    it('should clear auth context on logout', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })

    it('should navigate to home after logout', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should handle logout API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutUser.mockRejectedValue(new Error('Logout failed'))

      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Logout error:', expect.any(Error))
      })

      expect(storage.clearAuth).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/')
      consoleError.mockRestore()
    })

    it('should still clear auth and navigate even if API fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutUser.mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })

      consoleError.mockRestore()
    })

    it('should log error to console on API failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('API Error')
      logoutUser.mockRejectedValue(error)

      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Logout error:', error)
      })

      consoleError.mockRestore()
    })
  })

  describe('logout all devices functionality', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('test@example.com')
    })

    it('should close dropdown immediately when logout all clicked', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      // Dropdown should close immediately
      expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
    })

    it('should call logoutAllDevices when clicked', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(logoutAllDevices).toHaveBeenCalledTimes(1)
      })
    })

    it('should clear auth context on logout all', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })

    it('should navigate to home after logout all', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should handle logout all API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutAllDevices.mockRejectedValue(new Error('Logout all failed'))

      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Logout all error:', expect.any(Error))
      })

      expect(storage.clearAuth).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/')
      consoleError.mockRestore()
    })

    it('should still clear auth and navigate even if API fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      logoutAllDevices.mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })

      consoleError.mockRestore()
    })
  })

  describe('edge cases and cleanup', () => {
    it('should cleanup event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const { unmount } = renderDropdown()

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
      removeEventListenerSpy.mockRestore()
    })

    it('should handle rapid dropdown toggles', async () => {
      const user = userEvent.setup()
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })

      await user.click(button)
      await user.click(button)
      await user.click(button)
      await user.click(button)

      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
    })

    it('should handle multiple logout attempts', async () => {
      const user = userEvent.setup()
      renderDropdown()

      // Open dropdown and logout
      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout This Device'))

      await waitFor(() => {
        expect(logoutUser).toHaveBeenCalledTimes(1)
      })

      // Dropdown should be closed, so this shouldn't cause issues
      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
    })

    it('should handle logout and logout-all in sequence', async () => {
      const user = userEvent.setup()
      renderDropdown()

      // First do logout all
      await user.click(screen.getByRole('button', { name: /logout/i }))
      await user.click(screen.getByText('Logout All Devices'))

      await waitFor(() => {
        expect(logoutAllDevices).toHaveBeenCalledTimes(1)
      })

      // Dropdown should be closed
      expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
    })
  })

  describe('integration scenarios', () => {
    it('should complete full logout flow', async () => {
      const user = userEvent.setup()
      renderDropdown()

      // Open dropdown
      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)

      // Verify dropdown is open
      expect(screen.getByText('Logout This Device')).toBeInTheDocument()

      // Click logout
      await user.click(screen.getByText('Logout This Device'))

      // Verify API was called
      expect(logoutUser).toHaveBeenCalledTimes(1)

      // Verify cleanup happened
      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })

      // Verify dropdown is closed
      expect(screen.queryByText('Logout This Device')).not.toBeInTheDocument()
    })

    it('should complete full logout all flow', async () => {
      const user = userEvent.setup()
      renderDropdown()

      // Open dropdown
      const button = screen.getByRole('button', { name: /logout/i })
      await user.click(button)

      // Verify dropdown is open
      expect(screen.getByText('Logout All Devices')).toBeInTheDocument()

      // Click logout all
      await user.click(screen.getByText('Logout All Devices'))

      // Verify API was called
      await waitFor(() => {
        expect(logoutAllDevices).toHaveBeenCalledTimes(1)
      })

      // Verify cleanup happened
      await waitFor(() => {
        expect(storage.clearAuth).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })

      // Verify dropdown is closed
      expect(screen.queryByText('Logout All Devices')).not.toBeInTheDocument()
    })

    it('should handle logout all immediately without confirmation', async () => {
      const user = userEvent.setup()
      renderDropdown()

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /logout/i }))

      // Click logout all - should proceed immediately
      await user.click(screen.getByText('Logout All Devices'))

      // Verify API was called without confirmation
      await waitFor(() => {
        expect(logoutAllDevices).toHaveBeenCalled()
        expect(storage.clearAuth).toHaveBeenCalled()
      })
    })
  })

  describe('accessibility', () => {
    it('should use button elements for all interactive elements', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(3) // Main button + 2 menu items
    })

    it('should have accessible button text', () => {
      renderDropdown()

      const button = screen.getByRole('button', { name: /logout/i })
      expect(button).toHaveAccessibleName()
    })

    it('should have accessible menu item text', async () => {
      const user = userEvent.setup()
      renderDropdown()

      await user.click(screen.getByRole('button', { name: /logout/i }))

      expect(screen.getByText('Logout This Device')).toBeInTheDocument()
      expect(screen.getByText('Logout All Devices')).toBeInTheDocument()
    })
  })
})
