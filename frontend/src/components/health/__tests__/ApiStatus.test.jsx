import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ApiStatus from '../ApiStatus'
import { checkHealth } from '../../../api/services/healthService'

vi.mock('../../../api/services/healthService')

describe('ApiStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkHealth.mockResolvedValue({ status: 'ok' })
  })

  it('should render the API status label', () => {
    render(<ApiStatus />)

    expect(screen.getByText(/API Status:/)).toBeInTheDocument()
  })

  it('should have the api-status class', () => {
    const { container } = render(<ApiStatus />)

    expect(container.querySelector('.api-status')).toBeInTheDocument()
  })

  it('should display checking status initially', () => {
    checkHealth.mockImplementation(() => new Promise(() => {}))
    render(<ApiStatus />)

    expect(screen.getByTestId('api-status')).toHaveTextContent('checking')
  })

  it('should display ok status when API is healthy', async () => {
    render(<ApiStatus />)

    await waitFor(() => {
      expect(screen.getByTestId('api-status')).toHaveTextContent('ok')
    })
  })

  it('should display error status when API check fails', async () => {
    checkHealth.mockRejectedValue(new Error('Connection failed'))
    render(<ApiStatus />)

    await waitFor(() => {
      expect(screen.getByTestId('api-status')).toHaveTextContent('error')
    })
  })

  it('should call checkHealth on mount', async () => {
    render(<ApiStatus />)

    await waitFor(() => {
      expect(checkHealth).toHaveBeenCalled()
    })
  })
})
