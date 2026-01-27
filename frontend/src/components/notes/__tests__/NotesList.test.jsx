import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotesList from '../NotesList'

describe('NotesList', () => {
  const mockNotes = [
    { id: 1, content: 'First note' },
    { id: 2, content: 'Second note' },
    { id: 3, content: 'Third note' }
  ]

  describe('loading state', () => {
    it('should display loading message when loading', () => {
      render(<NotesList notes={[]} loading={true} />)

      expect(screen.getByTestId('notes-loading')).toBeInTheDocument()
      expect(screen.getByText('Loading notes...')).toBeInTheDocument()
    })

    it('should not display notes when loading', () => {
      render(<NotesList notes={mockNotes} loading={true} />)

      expect(screen.queryByTestId('notes-list')).not.toBeInTheDocument()
      expect(screen.queryByText('First note')).not.toBeInTheDocument()
    })

    it('should not display empty message when loading', () => {
      render(<NotesList notes={[]} loading={true} />)

      expect(screen.queryByTestId('notes-empty')).not.toBeInTheDocument()
    })

    it('should have correct CSS class for loading', () => {
      render(<NotesList notes={[]} loading={true} />)

      const loading = screen.getByTestId('notes-loading')
      expect(loading).toHaveClass('notes-loading')
    })
  })

  describe('empty state', () => {
    it('should display empty message when no notes', () => {
      render(<NotesList notes={[]} loading={false} />)

      expect(screen.getByTestId('notes-empty')).toBeInTheDocument()
      expect(screen.getByText('No notes yet. Add your first note!')).toBeInTheDocument()
    })

    it('should not display notes list when empty', () => {
      render(<NotesList notes={[]} loading={false} />)

      expect(screen.queryByTestId('notes-list')).not.toBeInTheDocument()
    })

    it('should have correct CSS class for empty', () => {
      render(<NotesList notes={[]} loading={false} />)

      const empty = screen.getByTestId('notes-empty')
      expect(empty).toHaveClass('notes-empty')
    })
  })

  describe('notes list', () => {
    it('should render list of notes', () => {
      render(<NotesList notes={mockNotes} loading={false} />)

      expect(screen.getByTestId('notes-list')).toBeInTheDocument()
      expect(screen.getAllByTestId('note-item')).toHaveLength(3)
    })

    it('should display note content', () => {
      render(<NotesList notes={mockNotes} loading={false} />)

      expect(screen.getByText('First note')).toBeInTheDocument()
      expect(screen.getByText('Second note')).toBeInTheDocument()
      expect(screen.getByText('Third note')).toBeInTheDocument()
    })

    it('should display note IDs', () => {
      render(<NotesList notes={mockNotes} loading={false} />)

      expect(screen.getByText('(#1)')).toBeInTheDocument()
      expect(screen.getByText('(#2)')).toBeInTheDocument()
      expect(screen.getByText('(#3)')).toBeInTheDocument()
    })

    it('should render single note', () => {
      const singleNote = [{ id: 1, content: 'Only note' }]
      render(<NotesList notes={singleNote} loading={false} />)

      expect(screen.getAllByTestId('note-item')).toHaveLength(1)
      expect(screen.getByText('Only note')).toBeInTheDocument()
    })

    it('should have correct CSS classes', () => {
      render(<NotesList notes={mockNotes} loading={false} />)

      const list = screen.getByTestId('notes-list')
      expect(list).toHaveClass('notes-list')

      const items = screen.getAllByTestId('note-item')
      items.forEach(item => {
        expect(item).toHaveClass('note-item')
      })
    })

    it('should render note content with correct class', () => {
      render(<NotesList notes={mockNotes} loading={false} />)

      const contents = screen.getByText('First note')
      expect(contents).toHaveClass('note-content')
    })

    it('should render note ID with correct class', () => {
      render(<NotesList notes={mockNotes} loading={false} />)

      const id = screen.getByText('(#1)')
      expect(id).toHaveClass('note-id')
    })
  })

  describe('notes with special characters', () => {
    it('should render notes with special characters', () => {
      const specialNotes = [
        { id: 1, content: 'Note with "quotes"' },
        { id: 2, content: "Note with 'apostrophes'" },
        { id: 3, content: 'Note with <brackets>' }
      ]

      render(<NotesList notes={specialNotes} loading={false} />)

      expect(screen.getByText('Note with "quotes"')).toBeInTheDocument()
      expect(screen.getByText("Note with 'apostrophes'")).toBeInTheDocument()
      expect(screen.getByText('Note with <brackets>')).toBeInTheDocument()
    })

    it('should render notes with emojis', () => {
      const emojiNotes = [
        { id: 1, content: 'Happy note 😊' },
        { id: 2, content: '🚀 Rocket note' }
      ]

      render(<NotesList notes={emojiNotes} loading={false} />)

      expect(screen.getByText('Happy note 😊')).toBeInTheDocument()
      expect(screen.getByText('🚀 Rocket note')).toBeInTheDocument()
    })

    it('should render long notes', () => {
      const longNote = {
        id: 1,
        content: 'This is a very long note that contains a lot of text and should still render properly in the list component without any issues'
      }

      render(<NotesList notes={[longNote]} loading={false} />)

      expect(screen.getByText(longNote.content)).toBeInTheDocument()
    })
  })

  describe('key prop', () => {
    it('should use note.id as key', () => {
      const { container } = render(<NotesList notes={mockNotes} loading={false} />)

      const items = container.querySelectorAll('.note-item')
      expect(items).toHaveLength(3)
      // Keys are not directly testable but the component should render without warnings
    })
  })
})