import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LogoutDropdown from '../LogoutDropdown'
import { AuthProvider } from '../../../contexts/AuthProvider'
import { storage } from '../../../utils/storage'
import { logoutUser, logoutAllDevices, clearAuthCookies } from '../../../api/services/authService'
import { errorBody } from '../../../test/fixtures'

vi.mock('../../../utils/storage')
vi.mock('../../../api/services/authService')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const httpError = (status, code, message) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: code ? errorBody(code, message) : {} },
  })

describe('LogoutDropdown', () => {
  beforeEach(() => {
    storage.getAccessToken.mockReturnValue('valid-token')
    storage.getRefreshCsrf.mockReturnValue('valid-csrf')
    storage.getEmail.mockReturnValue('test@example.com')
    logoutUser.mockResolvedValue()
    logoutAllDevices.mockResolvedValue()
    clearAuthCookies.mockResolvedValue()
    // A failed logout is logged; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderDropdown() {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LogoutDropdown />
        </AuthProvider>
      </BrowserRouter>
    )
    return userEvent.setup()
  }

  const toggle = () => screen.getByRole('button', { name: /^logout [▾▴]$/i })
  const thisDevice = () => screen.queryByRole('button', { name: 'Logout This Device' })
  const allDevices = () => screen.queryByRole('button', { name: 'Logout All Devices' })

  async function choose(user, item) {
    await user.click(toggle())
    await user.click(screen.getByRole('button', { name: item }))
  }

  async function expectSessionEnded() {
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(storage.clearAuth).toHaveBeenCalled()
  }

  describe('menu', () => {
    it('starts closed and toggles with its button', async () => {
      const user = renderDropdown()
      expect(thisDevice()).not.toBeInTheDocument()

      await user.click(toggle())
      expect(thisDevice()).toBeInTheDocument()
      expect(allDevices()).toBeInTheDocument()

      await user.click(toggle())
      expect(thisDevice()).not.toBeInTheDocument()
    })

    it('closes on a click outside it, but not on one inside', async () => {
      const user = renderDropdown()
      await user.click(toggle())

      await user.click(thisDevice().parentElement)
      expect(thisDevice()).toBeInTheDocument()

      await user.click(document.body)
      expect(thisDevice()).not.toBeInTheDocument()
    })
  })

  describe('Logout This Device', () => {
    it('logs out on the server, ends the session and goes home', async () => {
      const user = renderDropdown()

      await choose(user, 'Logout This Device')

      expect(thisDevice()).not.toBeInTheDocument()
      await expectSessionEnded()
      expect(logoutUser).toHaveBeenCalledTimes(1)
      // The logout response already expired the refresh cookie
      expect(clearAuthCookies).not.toHaveBeenCalled()
    })

    it('still ends the session if the server call fails, and clears the cookie', async () => {
      logoutUser.mockRejectedValue(new Error('Network Error'))
      const user = renderDropdown()

      await choose(user, 'Logout This Device')

      await expectSessionEnded()
      // HttpOnly: only the server can expire it
      expect(clearAuthCookies).toHaveBeenCalledTimes(1)
    })

    it('still ends the session if clearing the cookie fails too', async () => {
      logoutUser.mockRejectedValue(new Error('Network Error'))
      clearAuthCookies.mockRejectedValue(new Error('Network Error'))
      const user = renderDropdown()

      await choose(user, 'Logout This Device')

      await expectSessionEnded()
    })
  })

  describe('Logout All Devices', () => {
    it('signs every device out, ends this session and goes home', async () => {
      const user = renderDropdown()

      await choose(user, 'Logout All Devices')

      await expectSessionEnded()
      expect(logoutAllDevices).toHaveBeenCalledTimes(1)
    })

    // Other devices stay signed in unless the server revoked them, so a
    // failure must say so and leave this session for a retry
    it.each([
      ['the server fails', httpError(503, 'SERVICE_UNAVAILABLE', 'Could not sign out other devices'),
        'Could not sign out other devices'],
      ['the network fails', new Error('Network Error'), 'Network error'],
    ])('keeps the session and says so when %s', async (_, error, message) => {
      logoutAllDevices.mockRejectedValue(error)
      const user = renderDropdown()

      await choose(user, 'Logout All Devices')

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(storage.clearAuth).not.toHaveBeenCalled()
      expect(clearAuthCookies).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('ends the session when the server says it is already over (401)', async () => {
      logoutAllDevices.mockRejectedValue(httpError(401))
      const user = renderDropdown()

      await choose(user, 'Logout All Devices')

      await expectSessionEnded()
      expect(clearAuthCookies).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('hides the error when the menu is opened again', async () => {
      logoutAllDevices.mockRejectedValue(httpError(503, 'SERVICE_UNAVAILABLE'))
      const user = renderDropdown()
      await choose(user, 'Logout All Devices')
      await screen.findByRole('alert')

      await user.click(toggle())

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(allDevices()).toBeInTheDocument()
    })
  })
})
