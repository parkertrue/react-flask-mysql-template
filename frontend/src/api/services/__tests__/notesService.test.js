import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchNotes, createNote } from '../notesService'
import { api } from '../../api'

vi.mock('../../api')

describe('notesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchNotes', () => {
    it('should call GET /notes', async () => {
      const mockNotes = [
        { id: 1, content: 'Note 1', created_at: '2024-01-01' },
        { id: 2, content: 'Note 2', created_at: '2024-01-02' }
      ]
      api.get.mockResolvedValue({ data: mockNotes })

      const result = await fetchNotes()

      expect(api.get).toHaveBeenCalledWith('/notes')
      expect(result).toEqual(mockNotes)
    })

    it('should return empty array when no notes', async () => {
      api.get.mockResolvedValue({ data: [] })

      const result = await fetchNotes()

      expect(result).toEqual([])
    })

    it('should propagate errors from API', async () => {
      const error = new Error('Failed to fetch notes')
      api.get.mockRejectedValue(error)

      await expect(fetchNotes()).rejects.toThrow('Failed to fetch notes')
    })
  })

  describe('createNote', () => {
    it('should call POST /notes with content', async () => {
      const mockNote = {
        id: 1,
        content: 'New note',
        created_at: '2024-01-01'
      }
      api.post.mockResolvedValue({ data: mockNote })

      const result = await createNote('New note')

      expect(api.post).toHaveBeenCalledWith('/notes', {
        content: 'New note'
      })
      expect(result).toEqual(mockNote)
    })

    it('should handle empty content', async () => {
      const mockNote = {
        id: 1,
        content: '',
        created_at: '2024-01-01'
      }
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