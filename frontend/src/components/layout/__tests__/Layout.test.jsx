import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Link } from 'react-router-dom'
import Layout from '../Layout'
import { renderRoutes } from '@/test/router'

function renderLayout(path = '/') {
  return renderRoutes([{
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <><Link to="/about">About us</Link> <Link to="/plain">Plain</Link></>,
      },
      { path: 'about', element: <><h1>About</h1><p>About content</p></> },
      { path: 'plain', element: <p>No heading here</p> },
    ],
  }], path)
}

describe('Layout', () => {
  it('puts the page in the main area, under the navbar', () => {
    renderLayout('/about')

    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('navigation'))
    expect(screen.getByRole('main')).toHaveTextContent('About content')
  })

  it('leaves focus alone on the first page', () => {
    renderLayout()

    expect(screen.getByRole('main')).not.toHaveFocus()
  })

  it('moves focus to the new page\'s heading on navigation', async () => {
    const { user } = renderLayout()

    await user.click(screen.getByRole('link', { name: 'About us' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'About' })).toHaveFocus()
  })

  it('focuses the main area on a page without a heading', async () => {
    const { user } = renderLayout()

    await user.click(screen.getByRole('link', { name: 'Plain' }))

    expect(await screen.findByText('No heading here')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
  })
})
