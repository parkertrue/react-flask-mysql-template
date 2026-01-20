import { useState, useEffect } from 'react'
import { fetchNotes, createNote } from '../api/services/notesService'
import { getErrorMessage } from '../api/errors'
import { useAuth } from './useAuth'

export function useNotes() {
  const { isAuthenticated } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load notes when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setNotes([])
      return
    }

    loadNotes()
  }, [isAuthenticated])

  const loadNotes = async () => {
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
  }

  const addNote = async (content) => {
    try {
      const newNote = await createNote(content)
      setNotes(prev => [...prev, newNote])
      return newNote
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      throw new Error(errorMsg)
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