import { api } from '../api'

// One page of notes, newest first: { notes, next_cursor }. Pass a page's
// next_cursor to fetch the page after it; next_cursor is null on the last page.
export async function fetchNotes(before) {
  const response = await api.get('/notes', { params: { before } })
  return response.data
}

export async function createNote(content) {
  const response = await api.post('/notes', { content })
  return response.data
}
/*
export async function deleteNote(id) {
  await api.delete(`/notes/${id}`)
}

export async function updateNote(id, content) {
  const response = await api.put(`/notes/${id}`, { content })
  return response.data
}*/