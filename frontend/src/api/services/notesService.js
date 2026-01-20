import { api } from '../api'

export async function fetchNotes() {
  const response = await api.get('/notes')
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