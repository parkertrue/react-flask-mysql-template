import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotesList from '../NotesList'

// Each row's text, less its Edit and Delete buttons
const listed = () => screen.getAllByRole('listitem')
  .map(item => item.textContent.replace(/EditDelete$/, ''))

describe('NotesList', () => {
  it('shows only a loading message while loading', () => {
    render(<NotesList notes={[{ id: 1, content: 'Hidden' }]} loading={true} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading notes...')
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    expect(screen.queryByText(/no notes yet/i)).not.toBeInTheDocument()
  })

  it('invites a first note when there are none', () => {
    render(<NotesList notes={[]} loading={false} />)

    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists each note with its number, in the order given', () => {
    render(<NotesList notes={[{ id: 3, content: 'Third' }, { id: 1, content: 'First' }]} loading={false} />)

    expect(listed()).toEqual(['Third(#3)', 'First(#1)'])
  })

  it.each([
    [0, 'Edit note #3', 'Third'],
    [1, 'Delete note #3', 'Third'],
    [2, 'Edit note #1', 'First'],
    [3, 'Delete note #1', 'First'],
  ])('offers Edit and Delete per note, named by number and described by text (button %i)', (index, name, text) => {
    render(<NotesList notes={[{ id: 3, content: 'Third' }, { id: 1, content: 'First' }]} loading={false} />)

    const button = screen.getAllByRole('button')[index]
    expect(button).toHaveAccessibleName(name)
    expect(button).toHaveAccessibleDescription(text)
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
