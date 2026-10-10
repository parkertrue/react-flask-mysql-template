import { http, HttpResponse } from 'msw'

// Fake notes API responses, built like test/fixtures.js's: a mocked response
// cannot drift from the real one.

/** A note as the notes endpoints return it; created_at is UTC with an offset */
export function note(overrides = {}) {
  const id = overrides.id ?? 1
  return {
    id,
    user_id: 1,
    content: `Note ${id}`,
    created_at: '2026-01-01T12:00:00+00:00',
    ...overrides,
  }
}

/** One page of GET /api/notes; partial notes are filled in with note() */
export function notesPage(notes = [], next_cursor = null) {
  return { notes: notes.map(note), next_cursor }
}

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
