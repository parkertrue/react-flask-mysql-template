import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ApiStatus from '../ApiStatus'
import { checkHealth } from '../../../api/services/healthService'

vi.mock('../../../api/services/healthService')

describe('ApiStatus', () => {
  beforeEach(() => {
    checkHealth.mockResolvedValue({ status: 'ok' })
  })

  it('labels the status it shows', async () => {
    render(<ApiStatus />)

    expect(screen.getByText(/API Status:/)).toBeInTheDocument()
    // Let the health check settle inside the test
    await screen.findByText('ok')
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
