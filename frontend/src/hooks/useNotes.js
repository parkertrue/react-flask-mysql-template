import { useState, useEffect, useCallback } from 'react'
import { fetchNotes, createNote } from '../api/services/notesService'
import { getErrorMessage } from '../api/errors'
import { useAuth } from './useAuth'

export function useNotes() {
  const { isAuthenticated } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchNotes()
      setNotes(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    // Fetching on login is what this effect is for; the loading flag that
    // loadNotes sets before its first await is the one extra render we want.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotes()
    // Drop this session's notes when it ends, so the next user never sees them
    return () => setNotes([])
  }, [isAuthenticated, loadNotes])

  const addNote = async (content) => {
    try {
      const newNote = await createNote(content)
      setNotes(prev => [...prev, newNote])
      setError(null)
      return newNote
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      throw new Error(errorMsg, { cause: err })
    }
  }

  return {
    notes,
    loading,
    error,
    loadNotes,
    addNote
  }
}