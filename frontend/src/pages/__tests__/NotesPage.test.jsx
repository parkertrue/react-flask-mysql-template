import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import NotesPage from '../NotesPage'
import { AuthProvider } from '../../contexts/AuthProvider'
import { storage } from '../../utils/storage'
import { fetchNotes, createNote } from '../../api/services/notesService'
import { errorBody, note, notesPage } from '../../test/fixtures'

vi.mock('../../utils/storage')
vi.mock('../../api/services/notesService')

// The page wires useNotes to the form, the list, the error and "Load more";
// the hook's own state handling is tested in useNotes.test.jsx.
describe('NotesPage', () => {
  beforeEach(() => {
    storage.getAccessToken.mockReturnValue('valid-token')
    storage.getRefreshCsrf.mockReturnValue('csrf-token')
    storage.getEmail.mockReturnValue('user@example.com')
    fetchNotes.mockResolvedValue(notesPage())
  })

  function renderPage() {
    render(
      <MemoryRouter>
        <AuthProvider>
          <NotesPage />
        </AuthProvider>
      </MemoryRouter>
    )
    return userEvent.setup()
  }

  const listed = () => screen.getAllByTestId('note-item').map(item => item.textContent)
  const failure = message => Object.assign(new Error('500'), {
    response: { status: 500, data: errorBody('INTERNAL_ERROR', message) },
  })

  async function addNote(user, text) {
    await user.type(screen.getByLabelText('New note'), text)
    await user.click(screen.getByRole('button', { name: 'Add Note' }))
  }

  it('shows a loading state, then the user\'s notes', async () => {
    fetchNotes.mockResolvedValue(notesPage([{ id: 2, content: 'Second' }, { id: 1, content: 'First' }]))
    renderPage()

    expect(screen.getByRole('heading', { name: /my notes/i })).toBeInTheDocument()
    expect(screen.getByTestId('notes-loading')).toBeInTheDocument()

    expect(await screen.findByText('Second')).toBeInTheDocument()
    expect(listed()).toHaveLength(2)
  })

  it('shows the empty state when there are no notes', async () => {
    renderPage()

    expect(await screen.findByTestId('notes-empty')).toBeInTheDocument()
  })

  it('shows why the notes could not be loaded', async () => {
    fetchNotes.mockRejectedValue(failure('Something went wrong'))
    renderPage()

    expect(await screen.findByTestId('error-message')).toHaveTextContent('Something went wrong')
  })

  describe('adding a note', () => {
    it('puts it at the top of the list and empties the field', async () => {
      fetchNotes.mockResolvedValue(notesPage([{ id: 1, content: 'Existing' }]))
      createNote.mockResolvedValue(note({ id: 2, content: 'Fresh' }))
      const user = renderPage()
      await screen.findByText('Existing')

      await addNote(user, 'Fresh')

      expect(await screen.findByText('Fresh')).toBeInTheDocument()
      expect(createNote).toHaveBeenCalledWith('Fresh')
      expect(listed()[0]).toContain('Fresh')
      expect(screen.getByLabelText('New note')).toHaveValue('')
    })

    it('shows the error and keeps the text when saving fails', async () => {
      createNote.mockRejectedValue(failure('Could not save'))
      const user = renderPage()
      await screen.findByTestId('notes-empty')

      await addNote(user, 'Unsaved')

      expect(await screen.findByTestId('error-message')).toHaveTextContent('Could not save')
      expect(screen.getByLabelText('New note')).toHaveValue('Unsaved')
    })

    it('clears an earlier error once a note saves', async () => {
      createNote
        .mockRejectedValueOnce(failure('Could not save'))
        .mockResolvedValueOnce(note({ content: 'Unsaved' }))
      const user = renderPage()
      await screen.findByTestId('notes-empty')
      await addNote(user, 'Unsaved')
      await screen.findByTestId('error-message')

      await user.click(screen.getByRole('button', { name: 'Add Note' }))

      expect(await screen.findByText('Unsaved', { selector: '.note-content' })).toBeInTheDocument()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
    })

    it('locks the form while saving, but not while the list loads', async () => {
      fetchNotes.mockReturnValue(new Promise(() => {}))
      let finish
      createNote.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      const user = renderPage()

      // The list is still loading: the form stays usable
      expect(screen.getByLabelText('New note')).toBeEnabled()

      await addNote(user, 'Slow')

      expect(screen.getByLabelText('New note')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled()

      finish(note({ content: 'Slow' }))
      expect(await screen.findByRole('button', { name: 'Add Note' })).toBeInTheDocument()
      expect(screen.getByLabelText('New note')).toBeEnabled()
    })
  })

  describe('Load more', () => {
    it('is not offered when everything fits on one page', async () => {
      fetchNotes.mockResolvedValue(notesPage([{ id: 1, content: 'Only note' }]))
      renderPage()

      await screen.findByText('Only note')
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })

    it('adds the next page below the current one, then goes away', async () => {
      fetchNotes
        .mockResolvedValueOnce(notesPage([{ id: 2, content: 'Newer' }], 2))
        .mockResolvedValueOnce(notesPage([{ id: 1, content: 'Older' }]))
      const user = renderPage()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      expect(await screen.findByText('Older')).toBeInTheDocument()
      expect(fetchNotes).toHaveBeenLastCalledWith(2)
      expect(listed().map(text => text.replace(/\(#\d+\)/, ''))).toEqual(['Newer', 'Older'])
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })

    it('is disabled while the next page loads', async () => {
      fetchNotes
        .mockResolvedValueOnce(notesPage([{ id: 2, content: 'Newer' }], 2))
        .mockReturnValueOnce(new Promise(() => {}))
      const user = renderPage()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      const button = screen.getByRole('button', { name: 'Loading...' })
      expect(button).toBeDisabled()
      expect(within(screen.getByTestId('notes-list')).getByText('Newer')).toBeInTheDocument()
    })
  })
})
