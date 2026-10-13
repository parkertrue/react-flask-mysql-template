import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import HomePage from '../HomePage'
import { renderRoutes, signIn } from '@/test/router'
import { handlers, setupMswServer } from '@/test/server'
import { APP_NAME } from '@/appName'

setupMswServer(...handlers)

async function renderPage() {
  renderRoutes([{ path: '/', element: <HomePage /> }])
  // The API status demo checks the API on mount: wait for its answer, so no
  // request outlives the test
  expect(await screen.findByText('API Status: ok')).toBeInTheDocument()
}

const links = () => Object.fromEntries(
  screen.getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])
)

describe('HomePage', () => {
  it('welcomes the visitor', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 1, name: `Welcome to ${APP_NAME}` })).toBeInTheDocument()
    expect(document.title).toBe(APP_NAME)
  })

  it('offers a visitor registration and login', async () => {
    await renderPage()

    expect(links()).toEqual({ 'Get started': '/register', 'Log in': '/login' })
  })

  it('offers a signed-in user their notes instead', async () => {
    signIn()
    await renderPage()

    expect(links()).toEqual({ 'View my notes': '/notes' })
  })
})
