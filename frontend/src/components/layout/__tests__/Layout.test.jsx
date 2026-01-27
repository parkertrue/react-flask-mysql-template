import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from '../Layout'
import { AuthProvider } from '../../../contexts/AuthContext'
import { storage } from '../../../utils/storage'

vi.mock('../../../utils/storage')
vi.mock('../../../api/services/authService')

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const renderLayout = (initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<div>Home Content</div>} />
              <Route path="about" element={<div>About Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
  }

  it('should render with correct structure', () => {
    renderLayout()

    expect(screen.getByTestId('layout')).toBeInTheDocument()
    expect(screen.getByTestId('layout')).toHaveClass('layout')
  })

  it('should render Navbar component', () => {
    renderLayout()

    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('should render main content area', () => {
    renderLayout()

    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass('main-content')
  })

  it('should render outlet content', () => {
    renderLayout()

    expect(screen.getByText('Home Content')).toBeInTheDocument()
  })

  it('should render different routes in outlet', () => {
    renderLayout('/about')

    expect(screen.getByText('About Content')).toBeInTheDocument()
  })

  it('should maintain layout structure across route changes', () => {
    const { rerender } = renderLayout('/')

    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.getByText('Home Content')).toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/about']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<div>Home Content</div>} />
              <Route path="about" element={<div>About Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })
})