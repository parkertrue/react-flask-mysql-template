import { useState, useEffect, useCallback } from 'react'
import { getErrorMessage } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { fetchNotes, createNote } from './notesService'

export function useNotes() {
  const { isAuthenticated } = useAuth()
  const [notes, setNotes] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const page = await fetchNotes()
      setNotes(page.notes)
      setNextCursor(page.next_cursor)
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
    return () => {
      setNotes([])
      setNextCursor(null)
    }
  }, [isAuthenticated, loadNotes])

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchNotes(nextCursor)
      setNotes(prev => [...prev, ...page.notes])
      setNextCursor(page.next_cursor)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }

  const addNote = async (content) => {
    setSubmitting(true)
    try {
      const newNote = await createNote(content)
      // Newest first. The cursor points below the oldest loaded note, so the
      // new one never turns up again on a later page.
      setNotes(prev => [newNote, ...prev])
      setError(null)
      return newNote
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      throw new Error(errorMsg, { cause: err })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    notes,
    loading,
    loadingMore,
    hasMore: nextCursor !== null,
    submitting,
    error,
    loadMore,
    addNote
  }
}