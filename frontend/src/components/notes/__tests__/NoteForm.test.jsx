import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteForm from '../NoteForm'

describe('NoteForm', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderForm = (props = {}) => {
    return render(
      <NoteForm
        onSubmit={mockOnSubmit}
        loading={false}
        {...props}
      />
    )
  }

  describe('rendering', () => {
    it('should render form element', () => {
      renderForm()

      expect(screen.getByTestId('note-form')).toBeInTheDocument()
    })

    it('should render input field', () => {
      renderForm()

      const input = screen.getByTestId('note-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should render submit button', () => {
      renderForm()

      const button = screen.getByTestId('note-submit')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Add Note')
    })

    it('should have placeholder text', () => {
      renderForm()

      const input = screen.getByTestId('note-input')
      expect(input).toHaveAttribute('placeholder', 'Write a note...')
    })
  })

  describe('input handling', () => {
    it('should update input value on change', async () => {
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      await user.type(input, 'Test note')

      expect(input).toHaveValue('Test note')
    })

    it('should start with empty value', () => {
      renderForm()

      const input = screen.getByTestId('note-input')
      expect(input).toHaveValue('')
    })

    it('should handle multiple character inputs', async () => {
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      await user.type(input, 'This is a longer note with multiple words')

      expect(input).toHaveValue('This is a longer note with multiple words')
    })
  })

  describe('form submission', () => {
    it('should call onSubmit with content when form submitted', async () => {
      mockOnSubmit.mockResolvedValue()
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')

      await user.type(input, 'New note')
      await user.click(button)

      expect(mockOnSubmit).toHaveBeenCalledWith('New note')
      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
    })

    it('should clear input after successful submission', async () => {
      mockOnSubmit.mockResolvedValue()
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')

      await user.type(input, 'New note')
      await user.click(button)

      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('should submit on form enter key', async () => {
      mockOnSubmit.mockResolvedValue()
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')

      await user.type(input, 'New note{Enter}')

      expect(mockOnSubmit).toHaveBeenCalledWith('New note')
    })

    it('should not submit empty content', async () => {
      const user = userEvent.setup()
      renderForm()

      const button = screen.getByTestId('note-submit')
      await user.click(button)

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should not submit whitespace-only content', async () => {
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')

      await user.type(input, '   ')
      await user.click(button)

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should handle submission error', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Submission failed'))
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')

      await user.type(input, 'New note')
      await user.click(button)

      // Input should not be cleared on error
      expect(input).toHaveValue('New note')
    })
  })

  describe('loading state', () => {
    it('should disable input when loading', () => {
      renderForm({ loading: true })

      const input = screen.getByTestId('note-input')
      expect(input).toBeDisabled()
    })

    it('should disable button when loading', () => {
      renderForm({ loading: true })

      const button = screen.getByTestId('note-submit')
      expect(button).toBeDisabled()
    })

    it('should change button text when loading', () => {
      renderForm({ loading: true })

      const button = screen.getByTestId('note-submit')
      expect(button).toHaveTextContent('Adding...')
    })

    it('should enable input when not loading', () => {
      renderForm({ loading: false })

      const input = screen.getByTestId('note-input')
      expect(input).not.toBeDisabled()
    })
  })

  describe('button disabled state', () => {
    it('should disable button when content is empty', () => {
      renderForm()

      const button = screen.getByTestId('note-submit')
      expect(button).toBeDisabled()
    })

    it('should disable button when content is whitespace', async () => {
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')

      await user.type(input, '   ')

      expect(button).toBeDisabled()
    })

    it('should enable button when content is valid', async () => {
      const user = userEvent.setup()
      renderForm()

      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')

      await user.type(input, 'Valid note')

      expect(button).not.toBeDisabled()
    })

    it('should disable button during loading even with valid content', async () => {
      const user = userEvent.setup()
      const { rerender } = renderForm()

      const input = screen.getByTestId('note-input')
      await user.type(input, 'Valid note')

      rerender(<NoteForm onSubmit={mockOnSubmit} loading={true} />)

      const button = screen.getByTestId('note-submit')
      expect(button).toBeDisabled()
    })
  })

  describe('CSS classes', () => {
    it('should have correct form classes', () => {
      renderForm()

      const form = screen.getByTestId('note-form')
      expect(form).toHaveClass('note-form')
    })

    it('should have correct input classes', () => {
      renderForm()

      const input = screen.getByTestId('note-input')
      expect(input).toHaveClass('note-input')
    })

    it('should have correct button classes', () => {
      renderForm()

      const button = screen.getByTestId('note-submit')
      expect(button).toHaveClass('btn', 'btn-primary')
    })
  })
})