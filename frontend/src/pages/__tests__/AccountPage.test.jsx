import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import AccountPage from '../AccountPage'
import { storage } from '@/auth/storage'
import { logoutAllDevices, clearAuthCookies } from '@/auth/authService'
import { errorBody } from '@/test/fixtures'
import { renderRoutes, signIn } from '@/test/router'

vi.mock('@/auth/authService')

function renderPage() {
  signIn('user@example.com')
  return renderRoutes([
    { path: '/account', element: <AccountPage /> },
    { path: '/', element: <p>Home page</p> },
  ], '/account')
}

const logoutAll = () => screen.getByRole('button', { name: /logout all devices|logging out/i })

const httpError = (status, code, message) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: code ? errorBody(code, message) : {} },
  })

describe('AccountPage', () => {
  beforeEach(() => {
    logoutAllDevices.mockResolvedValue()
    clearAuthCookies.mockResolvedValue()
  })

  it('shows who is signed in', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
    expect(document.title).toBe('Account | React + Flask Template')
  })

  it('signs every device out, ends this session and goes home', async () => {
    const { user } = renderPage()

    await user.click(logoutAll())

    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(logoutAllDevices).toHaveBeenCalledTimes(1)
    expect(storage.getAccessToken()).toBeNull()
  })

  // Other devices stay signed in unless the server revoked them, so a
  // failure must say so and leave this session for a retry
  it.each([
    ['the server fails', httpError(503, 'SERVICE_UNAVAILABLE', 'Could not sign out other devices'),
      'Could not sign out other devices'],
    ['the network fails', new Error('Network Error'), 'Network error'],
  ])('keeps the session and says so when %s', async (_, error, message) => {
    logoutAllDevices.mockRejectedValue(error)
    const { user } = renderPage()

    await user.click(logoutAll())

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(storage.getAccessToken()).toBe('access-token')
    expect(clearAuthCookies).not.toHaveBeenCalled()
    expect(logoutAll()).toHaveAttribute('aria-disabled', 'false')
  })

  it.each([
    ['', () => {}],
    [', even if clearing the cookie fails', () => clearAuthCookies.mockRejectedValue(new Error('Network Error'))],
  ])('ends the session when the server says it is already over (401)%s', async (_, arrange) => {
    arrange()
    logoutAllDevices.mockRejectedValue(httpError(401))
    const { user } = renderPage()

    await user.click(logoutAll())

    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(storage.getAccessToken()).toBeNull()
    expect(clearAuthCookies).toHaveBeenCalledTimes(1)
  })

  it('clears an earlier error when trying again', async () => {
    logoutAllDevices.mockRejectedValueOnce(httpError(503, 'SERVICE_UNAVAILABLE'))
    const { user } = renderPage()
    await user.click(logoutAll())
    await screen.findByRole('alert')

    await user.click(logoutAll())

    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(logoutAllDevices).toHaveBeenCalledTimes(2)
  })

  it('keeps focus and ignores repeat clicks while the request is in flight', async () => {
    let finish
    logoutAllDevices.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { user } = renderPage()

    await user.click(logoutAll())
    await user.click(logoutAll())

    expect(logoutAll()).toHaveTextContent('Logging out...')
    expect(logoutAll()).toHaveAttribute('aria-disabled', 'true')
    expect(logoutAll()).toHaveFocus()
    expect(logoutAllDevices).toHaveBeenCalledTimes(1)
    await act(async () => finish())
  })
})
