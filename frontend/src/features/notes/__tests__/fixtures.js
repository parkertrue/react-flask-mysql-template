import { http, HttpResponse } from 'msw'
import { screen, within } from '@testing-library/react'

// Fake notes API responses, built like test/fixtures.js's: a mocked response
// cannot drift from the real one.

/** A note as the notes endpoints return it; created_at is UTC with an offset */
export function note(overrides = {}) {
  const id = overrides.id ?? 1
  return {
    id,
    content: `Note ${id}`,
    created_at: '2026-01-01T12:00:00+00:00',
    ...overrides,
  }
}

/** One page of GET /api/notes; partial notes are filled in with note() */
export function notesPage(notes = [], next_cursor = null) {
  return { notes: notes.map(note), next_cursor }
}

// Removes the last occurrence of part, so a note that mentions "Edit" keeps it
const withoutLast = (text, part) => {
  const at = text.lastIndexOf(part)
  return at === -1 ? text : text.slice(0, at) + text.slice(at + part.length)
}

/** Each listed note's text as the user reads it, less its buttons' labels */
export const listed = () => screen.getAllByRole('listitem').map(row =>
  within(row).queryAllByRole('button').reverse()
    .reduce((text, button) => withoutLast(text, button.textContent), row.textContent))

/** The happy path of the notes endpoints, for setupMswServer */
export const notesHandlers = [
  http.get('/api/notes', () => HttpResponse.json(notesPage())),
  http.post('/api/notes', async ({ request }) => {
    const { content } = await request.json()
    return HttpResponse.json(note({ content }), { status: 201 })
  }),
  http.put('/api/notes/:id', async ({ params, request }) => {
    const { content } = await request.json()
    return HttpResponse.json(note({ id: Number(params.id), content }))
  }),
  http.delete('/api/notes/:id', () => new HttpResponse(null, { status: 204 })),
]
