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
    { path: '/notes', element: <LogoutButton /> },
    { path: '/', element: <p>Home page</p> },
  ], '/notes')
}

async function logOut(user) {
  await user.click(screen.getByRole('button', { name: 'Logout' }))
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

  it('still ends the session if clearing the cookie fails too', async () => {
    logoutUser.mockRejectedValue(new Error('Network Error'))
    clearAuthCookies.mockRejectedValue(new Error('Network Error'))
    const { user } = renderButton()

    await logOut(user)

    expect(storage.getAccessToken()).toBeNull()
  })
})
