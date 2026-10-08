import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotesList from '../NotesList'

const listed = () => screen.getAllByTestId('note-item').map(item => item.textContent)

describe('NotesList', () => {
  it('shows only a loading message while loading', () => {
    render(<NotesList notes={[{ id: 1, content: 'Hidden' }]} loading={true} />)

    expect(screen.getByTestId('notes-loading')).toHaveTextContent('Loading notes...')
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    expect(screen.queryByTestId('notes-empty')).not.toBeInTheDocument()
  })

  it('invites a first note when there are none', () => {
    render(<NotesList notes={[]} loading={false} />)

    expect(screen.getByTestId('notes-empty')).toHaveTextContent(/no notes yet/i)
    expect(screen.queryByTestId('notes-list')).not.toBeInTheDocument()
  })

  it('lists each note with its number, in the order given', () => {
    render(<NotesList notes={[{ id: 3, content: 'Third' }, { id: 1, content: 'First' }]} loading={false} />)

    expect(listed()).toEqual(['Third(#3)', 'First(#1)'])
  })

  it('shows markup as text, never as HTML', () => {
    // The backend stores notes verbatim; React's escaping is the only guard
    const content = '<img src=x onerror="window.pwned=1"><b>bold</b>'
    const { container } = render(<NotesList notes={[{ id: 1, content }]} loading={false} />)

    expect(screen.getByText(content)).toBeInTheDocument()
    expect(container.querySelector('img, b')).toBeNull()
  })

  it('shows quotes, emoji and other Unicode as typed', () => {
    const content = 'He said "hi" & it\'s 🚀 — ünïcode'
    render(<NotesList notes={[{ id: 1, content }]} loading={false} />)

    expect(screen.getByText(content)).toBeInTheDocument()
  })
})
