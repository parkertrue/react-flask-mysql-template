import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../HomePage'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'
import { checkHealth } from '../../api/services/healthService'

vi.mock('../../utils/storage')
vi.mock('../../api/services/healthService')

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
    checkHealth.mockResolvedValue({ status: 'healthy' })
  })

  const renderHomePage = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </MemoryRouter>
    )
  }

  describe('content', () => {
    it('should render welcome heading', () => {
      renderHomePage()

      expect(screen.getByText('Welcome to Flask + React + MySQL Template App')).toBeInTheDocument()
    })

    it('should render description', () => {
      renderHomePage()

      expect(screen.getByText(/A simple note-taking application with/)).toBeInTheDocument()
    })

    it('should render API status label', () => {
      renderHomePage()

      expect(screen.getByText(/API Status:/)).toBeInTheDocument()
    })
  })

  describe('API health status', () => {
    it('should display checking status initially', () => {
      checkHealth.mockImplementation(() => new Promise(() => {}))
      renderHomePage()

      expect(screen.getByTestId('api-status')).toHaveTextContent('checking')
    })

    it('should display healthy status when API is healthy', async () => {
      checkHealth.mockResolvedValue({ status: 'healthy' })
      renderHomePage()

      await waitFor(() => {
        expect(screen.getByTestId('api-status')).toHaveTextContent('healthy')
      })
    })

    it('should display error status when API check fails', async () => {
      checkHealth.mockRejectedValue(new Error('Connection failed'))
      renderHomePage()

      await waitFor(() => {
        expect(screen.getByTestId('api-status')).toHaveTextContent('error')
      })
    })

    it('should call checkHealth on mount', async () => {
      renderHomePage()

      await waitFor(() => {
        expect(checkHealth).toHaveBeenCalled()
      })
    })
  })

  describe('when not authenticated', () => {
    it('should display guest actions', () => {
      renderHomePage()

      const guestActions = document.querySelector('.home-actions--guest')
      expect(guestActions).toBeInTheDocument()
    })

    it('should show Get Started button', () => {
      renderHomePage()

      const getStartedBtn = screen.getByText('Get Started')
      expect(getStartedBtn).toBeInTheDocument()
      expect(getStartedBtn).toHaveAttribute('href', '/register')
    })

    it('should show Login button', () => {
      renderHomePage()

      const loginBtn = screen.getByText('Login')
      expect(loginBtn).toBeInTheDocument()
      expect(loginBtn).toHaveAttribute('href', '/login')
    })

    it('should not show authenticated actions', () => {
      renderHomePage()

      expect(screen.queryByText('View My Notes')).not.toBeInTheDocument()
    })

    it('should have correct button classes', () => {
      renderHomePage()

      const getStartedBtn = screen.getByText('Get Started')
      const loginBtn = screen.getByText('Login')

      expect(getStartedBtn).toHaveClass('btn', 'btn-primary')
      expect(loginBtn).toHaveClass('btn', 'btn-secondary')
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('valid-token')
      storage.getEmail.mockReturnValue('user@example.com')
    })

    it('should display authenticated actions', () => {
      renderHomePage()

      const authActions = document.querySelector('.home-actions--authenticated')
      expect(authActions).toBeInTheDocument()
    })

    it('should show View My Notes button', () => {
      renderHomePage()

      const notesBtn = screen.getByText('View My Notes')
      expect(notesBtn).toBeInTheDocument()
      expect(notesBtn).toHaveAttribute('href', '/notes')
    })

    it('should not show guest actions', () => {
      renderHomePage()

      expect(screen.queryByText('Get Started')).not.toBeInTheDocument()
      expect(screen.queryByText('Login')).not.toBeInTheDocument()
    })

    it('should have correct button class', () => {
      renderHomePage()

      const notesBtn = screen.getByText('View My Notes')
      expect(notesBtn).toHaveClass('btn', 'btn-primary')
    })
  })

  describe('CSS classes and structure', () => {
    it('should have home-page wrapper', () => {
      const { container } = renderHomePage()

      const homePage = container.querySelector('.home-page')
      expect(homePage).toBeInTheDocument()
    })

    it('should have home-content container', () => {
      const { container } = renderHomePage()

      const content = container.querySelector('.home-content')
      expect(content).toBeInTheDocument()
    })

    it('should have api-status section', () => {
      const { container } = renderHomePage()

      const apiStatus = container.querySelector('.api-status')
      expect(apiStatus).toBeInTheDocument()
    })

    it('should have home-actions section', () => {
      const { container } = renderHomePage()

      const actions = container.querySelector('.home-actions')
      expect(actions).toBeInTheDocument()
    })
  })
})