import { describe, it, expect } from 'vitest'
import { act, screen } from '@testing-library/react'
import GuestRoute from '../GuestRoute'
import ProtectedRoute from '../ProtectedRoute'
import { renderRoutes, signIn } from '@/test/router'

const routes = [
  {
    element: <GuestRoute />,
    children: [{ path: '/login', element: <p>Login page</p> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/notes', element: <p>Notes page</p> },
      { path: '/account', element: <p>Account page</p> },
    ],
  },
]

describe('GuestRoute', () => {
  it('shows a visitor the page', () => {
    renderRoutes(routes, '/login')

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('sends a signed-in user to their notes', () => {
    signIn()
    renderRoutes(routes, '/login')

    expect(screen.getByText('Notes page')).toBeInTheDocument()
  })

  it('moves the user on as soon as they log in', () => {
    renderRoutes(routes, '/login')

    act(() => signIn())

    expect(screen.getByText('Notes page')).toBeInTheDocument()
  })

  it('returns the user to the page that sent them to log in', () => {
    renderRoutes(routes, '/account')
    expect(screen.getByText('Login page')).toBeInTheDocument()

    act(() => signIn())

    expect(screen.getByText('Account page')).toBeInTheDocument()
  })
})
