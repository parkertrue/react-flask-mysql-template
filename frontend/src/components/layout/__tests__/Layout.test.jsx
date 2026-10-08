import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from '../Layout'
import { AuthProvider } from '../../../contexts/AuthProvider'
import { storage } from '../../../utils/storage'

vi.mock('../../../utils/storage')

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<p>Home content</p>} />
            <Route path="about" element={<p>About content</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Layout', () => {
  beforeEach(() => {
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  it.each([
    ['/', 'Home content'],
    ['/about', 'About content'],
  ])('puts the page for %s in the main area, under the navbar', (path, content) => {
    renderAt(path)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(content)
  })
})
