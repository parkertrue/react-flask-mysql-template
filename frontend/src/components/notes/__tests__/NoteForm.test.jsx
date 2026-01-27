import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NoteForm from '../NoteForm'

describe('NoteForm', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render note input field', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Write a note...')
    })

    it('should render submit button', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const button = screen.getByTestId('note-submit')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Add Note')
    })

    it('should render character counter', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      expect(screen.getByText(/256 characters remaining/i)).toBeInTheDocument()
    })

    it('should render form with proper structure', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const form = screen.getByTestId('note-form')
      expect(form).toBeInTheDocument()
      expect(form.tagName).toBe('FORM')
    })

    it('should have correct input attributes', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      expect(input).toHaveAttribute('type', 'text')
      expect(input).toHaveAttribute('maxLength', '256')
    })
  })

  describe('user input', () => {
    it('should update input value when typing', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      fireEvent.change(input, { target: { value: 'Test note' } })
      
      expect(input).toHaveValue('Test note')
    })

    it('should update character counter when typing', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      fireEvent.change(input, { target: { value: 'Test note' } })
      
      expect(screen.getByText(/247 characters remaining/i)).toBeInTheDocument()
    })

    it('should handle empty input', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      fireEvent.change(input, { target: { value: '' } })
      
      expect(input).toHaveValue('')
      expect(screen.getByText(/256 characters remaining/i)).toBeInTheDocument()
    })

    it('should handle maximum length input', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const maxText = 'a'.repeat(256)
      fireEvent.change(input, { target: { value: maxText } })
      
      expect(input).toHaveValue(maxText)
      expect(screen.getByText(/0 characters remaining/i)).toBeInTheDocument()
    })

    it('should handle special characters', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      fireEvent.change(input, { target: { value: 'Note @#$% test!' } })
      
      expect(input).toHaveValue('Note @#$% test!')
    })

    it('should handle unicode characters', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      fireEvent.change(input, { target: { value: '🎉 Test note 🎊' } })
      
      expect(input).toHaveValue('🎉 Test note 🎊')
    })
  })

  describe('validation', () => {
    it('should show error for empty note', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const form = screen.getByTestId('note-form')
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('note-error')).toBeInTheDocument()
        expect(screen.getByTestId('note-error')).toHaveTextContent(/required/i)
      })
    })

    it('should show error for whitespace-only note', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('note-error')).toBeInTheDocument()
        expect(screen.getByTestId('note-error')).toHaveTextContent(/required/i)
      })
    })

    it('should show error for note exceeding maximum length', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      const tooLong = 'a'.repeat(257)
      fireEvent.change(input, { target: { value: tooLong } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('note-error')).toBeInTheDocument()
        expect(screen.getByTestId('note-error')).toHaveTextContent(/at most 256 characters/i)
      })
    })

    it('should clear error when user starts typing', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      // Trigger error
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.getByTestId('note-error')).toBeInTheDocument()
      })
      
      // Start typing
      fireEvent.change(input, { target: { value: 'Valid note' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('note-error')).not.toBeInTheDocument()
      })
    })

    it('should not show error for valid note', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: 'Valid note' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(screen.queryByTestId('note-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('should call onSubmit with trimmed content for valid note', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: '  Valid note  ' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('Valid note')
      })
    })

    it('should call onSubmit once per submission', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: 'Test note' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })
    })

    it('should clear input after successful submission', async () => {
      mockOnSubmit.mockResolvedValue({})
      
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: 'Test note' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('should not call onSubmit for empty note', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const form = screen.getByTestId('note-form')
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled()
      })
    })

    it('should not call onSubmit for whitespace-only note', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled()
      })
    })

    it('should not call onSubmit for note exceeding max length', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      const tooLong = 'a'.repeat(257)
      fireEvent.change(input, { target: { value: tooLong } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled()
      })
    })

    it('should handle submission with note at maximum length', async () => {
      mockOnSubmit.mockResolvedValue({})
      
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      const maxNote = 'a'.repeat(256)
      fireEvent.change(input, { target: { value: maxNote } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(maxNote)
      })
    })

    it('should handle submission error', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Submission failed'))
      
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: 'Test note' } })
      fireEvent.submit(form)
      
      await waitFor(() => {
        // Input should not be cleared on error
        expect(input).toHaveValue('Test note')
      })
    })
  })

  describe('loading state', () => {
    it('should disable input when loading', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={true} />)
      
      const input = screen.getByTestId('note-input')
      expect(input).toBeDisabled()
    })

    it('should disable button when loading', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={true} />)
      
      const button = screen.getByTestId('note-submit')
      expect(button).toBeDisabled()
    })

    it('should show loading text in button', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={true} />)
      
      const button = screen.getByTestId('note-submit')
      expect(button).toHaveTextContent('Adding...')
    })

    it('should not disable input when not loading', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      expect(input).not.toBeDisabled()
    })

    it('should prevent submission when loading', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={true} />)
      
      const button = screen.getByTestId('note-submit')
      expect(button).toBeDisabled()
      
      fireEvent.click(button)
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('button state', () => {
    it('should disable button when content is empty', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const button = screen.getByTestId('note-submit')
      expect(button).toBeDisabled()
    })

    it('should disable button when content is only whitespace', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')
      
      fireEvent.change(input, { target: { value: '   ' } })
      expect(button).toBeDisabled()
    })

    it('should enable button when content is valid', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')
      
      fireEvent.change(input, { target: { value: 'Valid note' } })
      expect(button).not.toBeDisabled()
    })

    it('should disable button when loading even with valid content', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={true} />)
      
      const input = screen.getByTestId('note-input')
      const button = screen.getByTestId('note-submit')
      
      fireEvent.change(input, { target: { value: 'Valid note' } })
      expect(button).toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('should have proper aria-invalid attribute', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      expect(input).toHaveAttribute('aria-invalid', 'false')
      
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('should have proper aria-describedby when error exists', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-describedby', 'note-error')
        expect(screen.getByTestId('note-error')).toHaveAttribute('id', 'note-error')
      })
    })

    it('should not have aria-describedby when no error', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      expect(input).not.toHaveAttribute('aria-describedby')
    })

    it('should have descriptive button text', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const button = screen.getByTestId('note-submit')
      expect(button).toHaveAccessibleName('Add Note')
    })
  })

  describe('CSS classes', () => {
    it('should apply error class when error exists', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      expect(input).not.toHaveClass('error')
      
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(input).toHaveClass('error')
      })
    })

    it('should remove error class when error is cleared', async () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.submit(form)
      
      await waitFor(() => {
        expect(input).toHaveClass('error')
      })
      
      fireEvent.change(input, { target: { value: 'Valid' } })
      
      await waitFor(() => {
        expect(input).not.toHaveClass('error')
      })
    })

    it('should have proper CSS classes', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      expect(screen.getByTestId('note-form')).toHaveClass('note-form')
      expect(screen.getByTestId('note-input')).toHaveClass('note-input')
    })
  })

  describe('edge cases', () => {
    it('should handle rapid typing', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      
      'Test note'.split('').forEach(char => {
        fireEvent.change(input, { target: { value: input.value + char } })
      })
      
      expect(input).toHaveValue('Test note')
    })

    it('should handle paste events', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      fireEvent.change(input, { target: { value: 'Pasted content' } })
      
      expect(input).toHaveValue('Pasted content')
    })

    it('should handle deletion', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      
      fireEvent.change(input, { target: { value: 'Test' } })
      expect(input).toHaveValue('Test')
      
      fireEvent.change(input, { target: { value: 'Tes' } })
      expect(input).toHaveValue('Tes')
    })

    it('should handle cut/clear all', () => {
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      
      fireEvent.change(input, { target: { value: 'Test note' } })
      expect(input).toHaveValue('Test note')
      
      fireEvent.change(input, { target: { value: '' } })
      expect(input).toHaveValue('')
    })

    it('should preserve trailing spaces before submission', () => {
      mockOnSubmit.mockResolvedValue({})
      
      render(<NoteForm onSubmit={mockOnSubmit} loading={false} />)
      
      const input = screen.getByTestId('note-input')
      const form = screen.getByTestId('note-form')
      
      fireEvent.change(input, { target: { value: 'Note   ' } })
      expect(input).toHaveValue('Note   ')
      
      fireEvent.submit(form)
      
      // But submit trimmed version
      expect(mockOnSubmit).toHaveBeenCalledWith('Note')
    })
  })
})
