import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import NotesPage from '../NotesPage'
import { AuthProvider } from '../../contexts/AuthProvider'
import { storage } from '../../utils/storage'
import { fetchNotes, createNote } from '../../api/services/notesService'

vi.mock('../../utils/storage')
vi.mock('../../api/services/notesService')

const page = (notes, next_cursor = null) => ({ notes, next_cursor })

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue('valid-token')
    storage.getRefreshCsrf.mockReturnValue('csrf-token')
    storage.getEmail.mockReturnValue('user@example.com')
    fetchNotes.mockResolvedValue(page([]))
  })

  const renderNotesPage = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <NotesPage />
        </AuthProvider>
      </MemoryRouter>
    )
  }

  describe('rendering', () => {
    it('should render page heading', () => {
      renderNotesPage()

      expect(screen.getByRole('heading', { name: /my notes/i })).toBeInTheDocument()
    })

    it('should render note form', async () => {
      renderNotesPage()

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByTestId('notes-loading')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('note-form')).toBeInTheDocument()
    })

    it('should render notes list', async () => {
      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByTestId('notes-empty')).toBeInTheDocument()
      })
    })

    it('should have notes-page wrapper', () => {
      const { container } = renderNotesPage()

      const page = container.querySelector('.notes-page')
      expect(page).toBeInTheDocument()
    })

    it('should have notes-container', () => {
      const { container } = renderNotesPage()

      const container_el = container.querySelector('.notes-container')
      expect(container_el).toBeInTheDocument()
    })
  })

  describe('loading notes on mount', () => {
    it('should fetch notes when component mounts', async () => {
      renderNotesPage()

      await waitFor(() => {
        expect(fetchNotes).toHaveBeenCalledTimes(1)
      })
    })

    it('should display loading state initially', () => {
      fetchNotes.mockImplementation(() => new Promise(() => {}))
      renderNotesPage()

      expect(screen.getByTestId('notes-loading')).toBeInTheDocument()
    })

    it('should display fetched notes', async () => {
      const mockNotes = [
        { id: 1, content: 'Note 1' },
        { id: 2, content: 'Note 2' }
      ]
      fetchNotes.mockResolvedValue(page(mockNotes))

      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument()
        expect(screen.getByText('Note 2')).toBeInTheDocument()
      })
    })

    it('should display empty state when no notes', async () => {
      fetchNotes.mockResolvedValue(page([]))

      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByTestId('notes-empty')).toBeInTheDocument()
      })
    })

    it('should display error message on fetch failure', async () => {
      fetchNotes.mockRejectedValue({
        response: {
          data: {
            error: { message: 'Failed to fetch notes' }
          }
        }
      })

      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to fetch notes')
      })
    })
  })

  describe('adding notes', () => {
    it('should add note when form is submitted', async () => {
      const newNote = { id: 1, content: 'New note' }
      fetchNotes.mockResolvedValue(page([]))
      createNote.mockResolvedValue(newNote)

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByTestId('notes-empty')).toBeInTheDocument()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'New note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith('New note')
      })
    })

    it('should display newly added note in the list', async () => {
      const newNote = { id: 1, content: 'Brand new note' }
      fetchNotes.mockResolvedValue(page([]))
      createNote.mockResolvedValue(newNote)

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByTestId('notes-empty')).toBeInTheDocument()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'Brand new note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Brand new note')).toBeInTheDocument()
      })
    })

    it('should append note to existing notes', async () => {
      const existingNotes = [
        { id: 1, content: 'Existing note' }
      ]
      const newNote = { id: 2, content: 'Another note' }

      fetchNotes.mockResolvedValue(page(existingNotes))
      createNote.mockResolvedValue(newNote)

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByText('Existing note')).toBeInTheDocument()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'Another note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Existing note')).toBeInTheDocument()
        expect(screen.getByText('Another note')).toBeInTheDocument()
      })
    })

    it('should clear form input after successful submission', async () => {
      const newNote = { id: 1, content: 'Test note' }
      fetchNotes.mockResolvedValue(page([]))
      createNote.mockResolvedValue(newNote)

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(fetchNotes).toHaveBeenCalled()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'Test note')
      expect(input).toHaveValue('Test note')

      await user.click(submitBtn)

      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('should display error when note creation fails', async () => {
      fetchNotes.mockResolvedValue(page([]))
      createNote.mockRejectedValue({
        response: {
          data: {
            error: { message: 'Failed to create note' }
          }
        }
      })

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(fetchNotes).toHaveBeenCalled()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'Test note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to create note')
      })
    })

    it('should not clear input when creation fails', async () => {
      fetchNotes.mockResolvedValue(page([]))
      createNote.mockRejectedValue({
        response: {
          data: {
            error: { message: 'Error' }
          }
        }
      })

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(fetchNotes).toHaveBeenCalled()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'Test note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })

      expect(input).toHaveValue('Test note')
    })
  })

  describe('loading state during note creation', () => {
    it('should show form disabled state during creation', async () => {
      fetchNotes.mockResolvedValue(page([]))
      
      // Create a slow promise to keep loading state active
      let resolveCreate
      createNote.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveCreate = resolve
        })
      })

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(screen.queryByTestId('notes-loading')).not.toBeInTheDocument()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      await user.type(input, 'Test note')
      await user.click(submitBtn)

      expect(createNote).toHaveBeenCalledWith('Test note')
      expect(submitBtn).toHaveTextContent('Adding...')
      expect(submitBtn).toBeDisabled()
      expect(input).toBeDisabled()

      resolveCreate({ id: 1, content: 'Test note' })

      await waitFor(() => {
        expect(submitBtn).toHaveTextContent('Add Note')
      })
      expect(input).not.toBeDisabled()
    })

    it('should not show "Adding..." while the list is loading', () => {
      fetchNotes.mockReturnValue(new Promise(() => {}))

      renderNotesPage()

      expect(screen.getByTestId('notes-loading')).toBeInTheDocument()
      expect(screen.getByTestId('note-submit')).toHaveTextContent('Add Note')
      expect(screen.getByTestId('note-input')).not.toBeDisabled()
    })
  })

  describe('error handling', () => {
    it('should clear error when successfully adding note after error', async () => {
      fetchNotes
        .mockResolvedValueOnce(page([]))
      
      createNote
        .mockRejectedValueOnce({
          response: { data: { error: { message: 'First error' } } }
        })
        .mockResolvedValueOnce({ id: 1, content: 'Success note' })

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(fetchNotes).toHaveBeenCalled()
      })

      const input = screen.getByTestId('note-input')
      const submitBtn = screen.getByTestId('note-submit')

      // First attempt - fails
      await user.type(input, 'Test note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })

      // Second attempt - succeeds
      await user.clear(input)
      await user.type(input, 'Success note')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      })
    })
  })

  describe('load more', () => {
    it('is hidden when there is only one page', async () => {
      fetchNotes.mockResolvedValue(page([{ id: 1, content: 'Only note' }]))

      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByText('Only note')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('load-more')).not.toBeInTheDocument()
    })

    it('loads the next page below the current one, then disappears', async () => {
      fetchNotes
        .mockResolvedValueOnce(page([{ id: 2, content: 'Newer note' }], 2))
        .mockResolvedValueOnce(page([{ id: 1, content: 'Older note' }]))

      const user = userEvent.setup()
      renderNotesPage()

      await user.click(await screen.findByTestId('load-more'))

      await waitFor(() => {
        expect(screen.getByText('Older note')).toBeInTheDocument()
      })
      expect(fetchNotes).toHaveBeenLastCalledWith(2)
      const items = screen.getAllByTestId('note-item').map(el => el.textContent)
      expect(items[0]).toContain('Newer note')
      expect(items[1]).toContain('Older note')
      expect(screen.queryByTestId('load-more')).not.toBeInTheDocument()
    })

    it('is disabled while the next page loads', async () => {
      fetchNotes
        .mockResolvedValueOnce(page([{ id: 2, content: 'Newer note' }], 2))
        .mockReturnValueOnce(new Promise(() => {}))

      const user = userEvent.setup()
      renderNotesPage()

      const button = await screen.findByTestId('load-more')
      await user.click(button)

      expect(button).toBeDisabled()
      expect(button).toHaveTextContent('Loading...')
    })
  })

  describe('integration with useNotes hook', () => {
    it('should use notes from useNotes hook', async () => {
      const mockNotes = [
        { id: 1, content: 'Hook note 1' },
        { id: 2, content: 'Hook note 2' }
      ]
      fetchNotes.mockResolvedValue(page(mockNotes))

      renderNotesPage()

      await waitFor(() => {
        expect(screen.getByText('Hook note 1')).toBeInTheDocument()
        expect(screen.getByText('Hook note 2')).toBeInTheDocument()
      })
    })

    it('should pass addNote function to form', async () => {
      const newNote = { id: 1, content: 'From hook' }
      fetchNotes.mockResolvedValue(page([]))
      createNote.mockResolvedValue(newNote)

      const user = userEvent.setup()
      renderNotesPage()

      await waitFor(() => {
        expect(fetchNotes).toHaveBeenCalled()
      })

      await user.type(screen.getByTestId('note-input'), 'From hook')
      await user.click(screen.getByTestId('note-submit'))

      await waitFor(() => {
        expect(screen.getByText('From hook')).toBeInTheDocument()
      })
    })
  })
})