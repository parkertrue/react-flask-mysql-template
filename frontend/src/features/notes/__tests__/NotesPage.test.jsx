import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import NotesPage from '../NotesPage'
import { fetchNotes, createNote } from '../notesService'
import { note, notesPage } from './fixtures'
import { errorBody } from '@/test/fixtures'
import { renderRoutes, signIn } from '@/test/router'

vi.mock('../notesService')

// The page wires useNotes to the form, the list, the error and "Load more";
// the hook's own state handling is tested in useNotes.test.jsx.
describe('NotesPage', () => {
  beforeEach(() => {
    fetchNotes.mockResolvedValue(notesPage())
  })

  function renderPage() {
    signIn()
    return renderRoutes([{ path: '/notes', element: <NotesPage /> }], '/notes').user
  }

  const listed = () => screen.getAllByRole('listitem').map(item => item.textContent)
  const failure = message => Object.assign(new Error('500'), {
    response: { status: 500, data: errorBody('INTERNAL_ERROR', message) },
  })
  const noNotesYet = () => screen.findByText(/no notes yet/i)

  async function addNote(user, text) {
    await user.type(screen.getByLabelText('New note'), text)
    await user.click(screen.getByRole('button', { name: 'Add Note' }))
  }

  it('shows a loading state, then the user\'s notes', async () => {
    fetchNotes.mockResolvedValue(notesPage([{ id: 2, content: 'Second' }, { id: 1, content: 'First' }]))
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'My Notes' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading notes...')
    expect(document.title).toBe('My Notes | React + Flask Template')

    expect(await screen.findByText('Second')).toBeInTheDocument()
    expect(listed()).toHaveLength(2)
  })

  it('shows the empty state when there are no notes', async () => {
    renderPage()

    expect(await noNotesYet()).toBeInTheDocument()
  })

  it('announces why the notes could not be loaded', async () => {
    fetchNotes.mockRejectedValue(failure('Something went wrong'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
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

    it('announces the error and keeps the text when saving fails', async () => {
      createNote.mockRejectedValue(failure('Could not save'))
      const user = renderPage()
      await noNotesYet()

      await addNote(user, 'Unsaved')

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
      expect(screen.getByLabelText('New note')).toHaveValue('Unsaved')
    })

    it('clears an earlier error once a note saves', async () => {
      createNote
        .mockRejectedValueOnce(failure('Could not save'))
        .mockResolvedValueOnce(note({ content: 'Unsaved' }))
      const user = renderPage()
      await noNotesYet()
      await addNote(user, 'Unsaved')
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: 'Add Note' }))

      expect(await screen.findByRole('listitem')).toHaveTextContent('Unsaved')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('blocks a second add while saving, but not while the list loads', async () => {
      fetchNotes.mockReturnValue(new Promise(() => {}))
      let finish
      createNote.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      const user = renderPage()

      // The list is still loading: the form stays usable
      expect(screen.getByLabelText('New note')).not.toHaveAttribute('readonly')

      await addNote(user, 'Slow')

      expect(screen.getByLabelText('New note')).toHaveAttribute('readonly')
      expect(screen.getByRole('button', { name: 'Adding...' })).toHaveAttribute('aria-disabled', 'true')

      finish(note({ content: 'Slow' }))
      expect(await screen.findByRole('button', { name: 'Add Note' })).toBeInTheDocument()
      expect(screen.getByLabelText('New note')).not.toHaveAttribute('readonly')
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

    it('refuses another click while the next page loads', async () => {
      fetchNotes
        .mockResolvedValueOnce(notesPage([{ id: 2, content: 'Newer' }], 2))
        .mockReturnValueOnce(new Promise(() => {}))
      const user = renderPage()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))
      await user.click(screen.getByRole('button', { name: 'Loading...' }))

      expect(screen.getByRole('button', { name: 'Loading...' })).toHaveAttribute('aria-disabled', 'true')
      expect(fetchNotes).toHaveBeenCalledTimes(2)
      expect(within(screen.getByRole('list')).getByText('Newer')).toBeInTheDocument()
    })
  })
})
