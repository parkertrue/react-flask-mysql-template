import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import HomePage from '../HomePage'
import { renderRoutes, signIn } from '@/test/router'
import { APP_NAME } from '@/appName'

// Tested on its own; a stub keeps these tests off the health endpoint
vi.mock('@/features/health/ApiStatus', () => ({ default: () => <p>API status demo</p> }))

const renderPage = () => renderRoutes([{ path: '/', element: <HomePage /> }])

const links = () => Object.fromEntries(
  screen.getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])
)

describe('HomePage', () => {
  it('welcomes the visitor and shows the API status demo', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: `Welcome to ${APP_NAME}` })).toBeInTheDocument()
    expect(screen.getByText('API status demo')).toBeInTheDocument()
    expect(document.title).toBe(APP_NAME)
  })

  it('offers a visitor registration and login', () => {
    renderPage()

    expect(links()).toEqual({ 'Get Started': '/register', Login: '/login' })
  })

  it('offers a signed-in user their notes instead', () => {
    signIn()
    renderPage()

    expect(links()).toEqual({ 'View My Notes': '/notes' })
  })
})
