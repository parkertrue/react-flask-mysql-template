import { describe, it, expect, vi } from 'vitest'
import { fetchNotes, createNote } from '../notesService'
import { api } from '@/api/api'
import { note, notesPage } from './fixtures'

vi.mock('@/api/api')

describe('notesService', () => {
  describe('fetchNotes', () => {
    it('should GET the first page without a cursor', async () => {
      const mockPage = notesPage([{ id: 2 }, { id: 1 }])
      api.get.mockResolvedValue({ data: mockPage })

      const result = await fetchNotes()

      expect(api.get).toHaveBeenCalledWith('/notes', { params: { before: undefined } })
      expect(result).toEqual(mockPage)
    })

    it('should pass the cursor as ?before=', async () => {
      api.get.mockResolvedValue({ data: notesPage() })

      await fetchNotes(42)

      expect(api.get).toHaveBeenCalledWith('/notes', { params: { before: 42 } })
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Failed to fetch notes')
      api.get.mockRejectedValue(error)

      await expect(fetchNotes()).rejects.toThrow('Failed to fetch notes')
    })
  })

  describe('createNote', () => {
    it('should call POST /notes with content', async () => {
      const mockNote = note({ content: 'New note' })
      api.post.mockResolvedValue({ data: mockNote })

      const result = await createNote('New note')

      expect(api.post).toHaveBeenCalledWith('/notes', {
        content: 'New note'
      })
      expect(result).toEqual(mockNote)
    })

    it('should handle empty content', async () => {
      const mockNote = note({ content: '' })
      api.post.mockResolvedValue({ data: mockNote })

      const result = await createNote('')

      expect(api.post).toHaveBeenCalledWith('/notes', { content: '' })
      expect(result).toEqual(mockNote)
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Failed to create note')
      api.post.mockRejectedValue(error)

      await expect(createNote('Test note')).rejects.toThrow('Failed to create note')
    })
  })
})