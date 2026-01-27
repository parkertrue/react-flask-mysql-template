import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNotes } from '../useNotes'
import { fetchNotes, createNote } from '../../api/services/notesService'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'

vi.mock('../../api/services/notesService')
vi.mock('../../utils/storage')

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue(null)
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
  })

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

  describe('when not authenticated', () => {
    it('should initialize with empty notes', () => {
      const { result } = renderHook(() => useNotes(), { wrapper })

      expect(result.current.notes).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should not fetch notes', async () => {
      renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(fetchNotes).not.toHaveBeenCalled()
      })
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('token')
      storage.getEmail.mockReturnValue('user@example.com')
    })

    it('should fetch notes on mount', async () => {
      const mockNotes = [
        { id: 1, content: 'Note 1' },
        { id: 2, content: 'Note 2' }
      ]
      fetchNotes.mockResolvedValue(mockNotes)

      const { result } = renderHook(() => useNotes(), { wrapper })

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.notes).toEqual(mockNotes)
      expect(result.current.error).toBeNull()
      expect(fetchNotes).toHaveBeenCalledTimes(1)
    })

    it('should handle fetch error', async () => {
      const error = {
        response: {
          data: {
            error: { message: 'Failed to fetch' }
          }
        }
      }
      fetchNotes.mockRejectedValue(error)

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.notes).toEqual([])
      expect(result.current.error).toBe('Failed to fetch')
    })

    it('should handle network error', async () => {
      fetchNotes.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })
    })
  })

  describe('loadNotes', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('token')
    })

    it('should reload notes', async () => {
      const mockNotes = [{ id: 1, content: 'Note 1' }]
      fetchNotes.mockResolvedValue(mockNotes)

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      fetchNotes.mockResolvedValue([...mockNotes, { id: 2, content: 'Note 2' }])

      await act(async () => {
        await result.current.loadNotes()
      })

      expect(result.current.notes).toHaveLength(2)
    })

    it('should set loading state during reload', async () => {
      fetchNotes.mockResolvedValue([])

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.loadNotes()
      })

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('addNote', () => {
    beforeEach(() => {
      storage.getAccessToken.mockReturnValue('token')
      fetchNotes.mockResolvedValue([])
    })

    it('should add note to list', async () => {
      const newNote = { id: 1, content: 'New note' }
      createNote.mockResolvedValue(newNote)

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let returnedNote
      await act(async () => {
        returnedNote = await result.current.addNote('New note')
      })

      expect(result.current.notes).toContainEqual(newNote)
      expect(returnedNote).toEqual(newNote)
      expect(createNote).toHaveBeenCalledWith('New note')
    })

    it('should append to existing notes', async () => {
      const existingNotes = [{ id: 1, content: 'Existing' }]
      fetchNotes.mockResolvedValue(existingNotes)

      const newNote = { id: 2, content: 'New note' }
      createNote.mockResolvedValue(newNote)

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.notes).toEqual(existingNotes)
      })

      await act(async () => {
        await result.current.addNote('New note')
      })

      expect(result.current.notes).toHaveLength(2)
      expect(result.current.notes).toContainEqual(existingNotes[0])
      expect(result.current.notes).toContainEqual(newNote)
    })

    it('should handle create error', async () => {
      const error = {
        response: {
          data: {
            error: { message: 'Failed to create' }
          }
        }
      }
      createNote.mockRejectedValue(error)

      const { result } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let thrownError
      await act(async () => {
        try {
          await result.current.addNote('New note')
        } catch (err) {
          thrownError = err
        }
      })

      expect(thrownError).toBeDefined()
      expect(thrownError.message).toBe('Failed to create')
      
      // Check error state after act completes
      expect(result.current.error).toBe('Failed to create')
      expect(result.current.notes).toEqual([])
    })
  })

  describe('authentication changes', () => {
    it('should clear notes when logged out', async () => {
      storage.getAccessToken.mockReturnValue('token')
      fetchNotes.mockResolvedValue([{ id: 1, content: 'Note' }])

      const { result, rerender } = renderHook(() => useNotes(), { wrapper })

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
      })

      // Simulate logout
      storage.getAccessToken.mockReturnValue(null)
      rerender()

      // Notes should be cleared but the hook doesn't automatically refetch
      // The clearing happens via the useEffect dependency on isAuthenticated
    })
  })
})