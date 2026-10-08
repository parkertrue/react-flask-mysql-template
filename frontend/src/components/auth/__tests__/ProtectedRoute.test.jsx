import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'
import { AuthProvider } from '../../../contexts/AuthProvider'
import { storage } from '../../../utils/storage'

vi.mock('../../../utils/storage')

function renderProtected({ signedIn }) {
  storage.getAccessToken.mockReturnValue(signedIn ? 'valid-token' : null)
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute><p>Protected content</p></ProtectedRoute>}
          />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  it('sends a visitor to the login page instead', () => {
    renderProtected({ signedIn: false })

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('shows a signed-in user the page', () => {
    renderProtected({ signedIn: true })

    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
