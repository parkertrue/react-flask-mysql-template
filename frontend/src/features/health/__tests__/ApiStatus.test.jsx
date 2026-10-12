import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ApiStatus from '../ApiStatus'
import { checkHealth } from '../healthService'

vi.mock('../healthService')

// The polling itself is tested in useHealth.test.js. The status is a live
// region, so a screen reader hears it change.
describe('ApiStatus', () => {
  it('shows that it is checking at first', () => {
    checkHealth.mockReturnValue(new Promise(() => {}))
    render(<ApiStatus />)

    expect(screen.getByRole('status')).toHaveTextContent('API Status: checking')
  })

  it.each([
    ['the status the API reports', () => checkHealth.mockResolvedValue({ status: 'ok' }), 'ok'],
    ['an error when the API is unreachable', () => checkHealth.mockRejectedValue(new Error('Down')), 'error'],
  ])('shows %s', async (_, arrange, status) => {
    arrange()
    render(<ApiStatus />)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`API Status: ${status}`))
  })
})
