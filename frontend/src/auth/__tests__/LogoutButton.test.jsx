import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import LogoutButton from '../LogoutButton'
import { storage } from '../storage'
import { logoutUser, clearAuthCookies } from '../authService'
import { renderRoutes, signIn } from '@/test/router'

vi.mock('../authService')

function renderButton() {
  signIn()
  return renderRoutes([
    { path: '/account', element: <LogoutButton /> },
    { path: '/', element: <p>Home page</p> },
  ], '/account')
}

async function logOut(user) {
  await user.click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByText('Home page')
}

describe('LogoutButton', () => {
  beforeEach(() => {
    logoutUser.mockResolvedValue()
    clearAuthCookies.mockResolvedValue()
  })

  it('logs out on the server, ends the session and goes home', async () => {
    const { user } = renderButton()

    await logOut(user)

    expect(logoutUser).toHaveBeenCalledTimes(1)
    expect(storage.getAccessToken()).toBeNull()
    // The logout response already expired the refresh cookie
    expect(clearAuthCookies).not.toHaveBeenCalled()
  })

  it('still ends the session if the server call fails, and clears the cookie', async () => {
    logoutUser.mockRejectedValue(new Error('Network Error'))
    const { user } = renderButton()

    await logOut(user)

    expect(storage.getAccessToken()).toBeNull()
    // HttpOnly: only the server can expire it
    expect(clearAuthCookies).toHaveBeenCalledTimes(1)
  })

  it('shows it is busy and logs out once however often it is clicked', async () => {
    let finish
    logoutUser.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { user } = renderButton()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    const button = screen.getByRole('button', { name: 'Logging out...' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    finish()
    await screen.findByText('Home page')

    expect(logoutUser).toHaveBeenCalledTimes(1)
  })

  it('still ends the session if clearing the cookie fails too', async () => {
    logoutUser.mockRejectedValue(new Error('Network Error'))
    clearAuthCookies.mockRejectedValue(new Error('Network Error'))
    const { user } = renderButton()

    await logOut(user)

    expect(storage.getAccessToken()).toBeNull()
  })
})
