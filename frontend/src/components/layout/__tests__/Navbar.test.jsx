import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import Navbar from '../Navbar'
import { renderRoutes, signIn } from '@/test/router'

function renderNavbar(path) {
  renderRoutes([{ path: '*', element: <Navbar /> }], path)
}

/** The main navigation's links, as { text: href } */
const links = () => Object.fromEntries(
  within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')
    .map(link => [link.textContent, link.getAttribute('href')])
)

const current = () => screen.getAllByRole('link')
  .filter(link => link.getAttribute('aria-current') === 'page')
  .map(link => link.textContent)

describe('Navbar', () => {
  it('offers a visitor the way in', () => {
    renderNavbar('/')

    expect(links()).toEqual({ Home: '/', Login: '/login', Register: '/register' })
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
  })

  it('offers a signed-in user their notes, account and logout', () => {
    signIn('user@example.com')
    renderNavbar('/')

    expect(links()).toEqual({ Home: '/', 'My Notes': '/notes' })
    // The email is the account link; its name says where it goes
    expect(screen.getByRole('link', { name: 'user@example.com (account)' }))
      .toHaveAttribute('href', '/account')
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })

  it.each([
    ['/', false, ['Home']],
    ['/login', false, ['Login']],
    ['/register', false, ['Register']],
    ['/notes', true, ['My Notes']],
    ['/account', true, ['user@example.com']],
  ])('marks the link to %s as the current page', (path, signedIn, expected) => {
    if (signedIn) signIn('user@example.com')
    renderNavbar(path)

    expect(current()).toEqual(expected)
  })
})
